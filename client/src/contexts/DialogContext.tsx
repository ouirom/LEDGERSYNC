import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

type DialogTone = 'info' | 'danger';

interface AlertOptions { title?: string; tone?: DialogTone; confirmLabel?: string; }
interface ConfirmOptions { title?: string; tone?: DialogTone; confirmLabel?: string; cancelLabel?: string; }
interface PromptOptions { title?: string; tone?: DialogTone; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string; minLength?: number; }

interface DialogContextValue {
  alert: (message: string, opts?: AlertOptions) => Promise<void>;
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, opts?: PromptOptions) => Promise<string | null>;
}

type Kind = 'alert' | 'confirm' | 'prompt';

interface ActiveDialog {
  kind: Kind;
  message: string;
  title?: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  minLength?: number;
  resolve: (value: unknown) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Remplace les dialogues natifs du navigateur (alert/confirm/prompt) — non
// stylables, bloquants, et incohérents avec le reste de l'UI — par une
// modale unique cohérente avec le design de l'application.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const [inputValue, setInputValue] = useState('');

  const open = useCallback((req: Omit<ActiveDialog, 'resolve'>) => {
    return new Promise<unknown>(resolve => {
      setActive({ ...req, resolve });
    });
  }, []);

  const alertFn = useCallback((message: string, opts?: AlertOptions) =>
    open({ kind: 'alert', message, ...opts }).then(() => undefined), [open]);

  const confirmFn = useCallback((message: string, opts?: ConfirmOptions) =>
    open({ kind: 'confirm', message, ...opts }) as Promise<boolean>, [open]);

  const promptFn = useCallback((message: string, opts?: PromptOptions) => {
    setInputValue(opts?.defaultValue || '');
    return open({ kind: 'prompt', message, ...opts }) as Promise<string | null>;
  }, [open]);

  const close = (result: unknown) => {
    active?.resolve(result);
    setActive(null);
  };

  if (!active) {
    return <DialogContext.Provider value={{ alert: alertFn, confirm: confirmFn, prompt: promptFn }}>{children}</DialogContext.Provider>;
  }

  const isPrompt = active.kind === 'prompt';
  const isAlert = active.kind === 'alert';
  const promptInvalid = isPrompt && !!active.minLength && inputValue.trim().length < active.minLength;

  const submit = () => {
    if (isAlert) return close(undefined);
    if (isPrompt) return promptInvalid ? undefined : close(inputValue);
    return close(true);
  };
  const dismiss = () => close(isPrompt ? null : isAlert ? undefined : false);

  return (
    <DialogContext.Provider value={{ alert: alertFn, confirm: confirmFn, prompt: promptFn }}>
      {children}
      <div className="modal-overlay" onClick={dismiss}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            {active.tone === 'danger'
              ? <AlertTriangle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
              : <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>
              {active.title || (active.kind === 'confirm' ? 'Confirmation' : active.kind === 'prompt' ? 'Information requise' : 'Information')}
            </h3>
            <button className="btn btn-ghost btn-icon" onClick={dismiss}><X size={16} /></button>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{active.message}</p>
          {isPrompt && (
            <div style={{ marginBottom: 8 }}>
              <input
                className="input"
                style={{ width: '100%' }}
                value={inputValue}
                placeholder={active.placeholder}
                autoFocus
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !promptInvalid) submit(); }}
              />
              {!!active.minLength && (
                <div style={{ fontSize: 11, color: promptInvalid ? 'var(--danger)' : 'var(--text-muted)', marginTop: 6 }}>
                  Minimum {active.minLength} caractères
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: isPrompt ? 8 : 0 }}>
            {!isAlert && (
              <button className="btn btn-ghost" onClick={dismiss}>{active.cancelLabel || 'Annuler'}</button>
            )}
            <button
              className={active.tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={submit}
              disabled={promptInvalid}
              autoFocus={!isPrompt}
            >
              {active.confirmLabel || (isAlert ? 'OK' : active.kind === 'confirm' ? 'Confirmer' : 'Valider')}
            </button>
          </div>
        </div>
      </div>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog doit être utilisé à l\'intérieur d\'un DialogProvider');
  return ctx;
}
