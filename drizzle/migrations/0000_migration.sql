
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX ON public.conversation_participants(user_id);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.messages(conversation_id, created_at);

GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.conversations, public.conversation_participants, public.messages TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conversation_id AND user_id = _user_id)
$$;

CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_participant(id, auth.uid()));
CREATE POLICY "Participants view participants" ON public.conversation_participants FOR SELECT TO authenticated USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants send as themselves" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_participant(conversation_id, auth.uid()));

-- Force server timestamp and bump conversation
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_at := now();
  NEW.content := btrim(NEW.content);
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER on_message_insert BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- Atomic DM creation
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _cid uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other IS NULL OR _other = _me THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other) THEN RAISE EXCEPTION 'User not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(least(_me::text,_other::text) || greatest(_me::text,_other::text)));
  SELECT a.conversation_id INTO _cid FROM public.conversation_participants a
    JOIN public.conversation_participants b ON a.conversation_id = b.conversation_id
    WHERE a.user_id = _me AND b.user_id = _other
      AND (SELECT count(*) FROM public.conversation_participants c WHERE c.conversation_id = a.conversation_id) = 2
    LIMIT 1;
  IF _cid IS NULL THEN
    INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO _cid;
    INSERT INTO public.conversation_participants VALUES (_cid, _me), (_cid, _other);
  END IF;
  RETURN _cid;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid) TO authenticated;

-- Profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u text; _base text;
BEGIN
  _base := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  IF char_length(_base) < 3 THEN _base := _base || 'user'; END IF;
  _base := left(_base, 18);
  _u := _base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = _u) LOOP
    _u := _base || floor(random()*100000)::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, _u, left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'),''), nullif(btrim(NEW.raw_user_meta_data->>'full_name'),''), _u), 50));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
