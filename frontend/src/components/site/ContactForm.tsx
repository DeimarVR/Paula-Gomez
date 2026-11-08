'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/apiClient';

interface ContactFormProps {
  whatsappLink: string;
}

export function ContactForm({ whatsappLink }: ContactFormProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: '',
    website: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      await api.post(
        '/api/public/contact',
        {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          subject: form.subject || undefined,
          message: form.message,
          website: form.website,
        },
        { auth: false },
      );
      setStatus('sent');
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Error inesperado'));
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-3xl border border-line bg-surface p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white">
          <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </span>
        <h2 className="mt-6 font-display text-2xl">Mensaje recibido</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Le respondemos dentro del horario de atención. Si es urgente, escríbanos directamente por
          WhatsApp.
        </p>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-7"
        >
          Ir a WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl border border-line bg-surface p-8 sm:p-10">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="field-label">
            Nombre *
          </label>
          <input
            id="name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="field"
          />
          {error instanceof ApiError && <p className="field-error">{error.fieldMessage('name')}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="field-label">
            Celular *
          </label>
          <input
            id="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className="field"
            placeholder="300 111 2233"
          />
          {error instanceof ApiError && (
            <p className="field-error">{error.fieldMessage('phone')}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="field-label">
            Correo <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="subject" className="field-label">
            Asunto <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="subject"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            className="field"
            placeholder="Consulta sobre un tratamiento"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="field-label">
            Mensaje *
          </label>
          <textarea
            id="message"
            required
            rows={5}
            minLength={10}
            maxLength={2000}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            className="field resize-none"
            placeholder="Cuéntenos su consulta y desde cuándo le ocurre."
          />
          {error instanceof ApiError && (
            <p className="field-error">{error.fieldMessage('message')}</p>
          )}
        </div>

        <div className="hidden" aria-hidden>
          <label htmlFor="website-contact">No completar</label>
          <input
            id="website-contact"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error.message}</p>
      )}

      <button type="submit" disabled={status === 'sending'} className="btn-primary mt-7 w-full">
        {status === 'sending' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          'Enviar mensaje'
        )}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        Al enviar acepta nuestra política de tratamiento de datos personales.
      </p>
    </form>
  );
}
