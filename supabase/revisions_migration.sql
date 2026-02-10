-- SQL Migration for Revisions Table
-- Please run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, delegated, completed
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see revisions for phases they have access to"
    ON public.revisions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phases p
            LEFT JOIN public.projects pr ON p.project_id = pr.id
            LEFT JOIN public.clients c ON pr.client_id = c.id
            WHERE p.id = revisions.phase_id
            AND (
                auth.uid() = pr.user_id OR -- Project owner
                auth.uid() = c.user_id OR -- Client
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'employee'))
            )
        )
    );

CREATE POLICY "Clients can create revisions for their phases"
    ON public.revisions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.phases p
            JOIN public.projects pr ON p.project_id = pr.id
            JOIN public.clients c ON pr.client_id = c.id
            WHERE p.id = phase_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and employees can update revisions"
    ON public.revisions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'employee')
        )
    );
