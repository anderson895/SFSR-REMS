import { useCallback, useEffect, useRef, useState } from 'react';

export interface PromptOptions {
  title: string;
  /** Consequences of confirming — what the buyer will see, what gets released. */
  message?: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  /** When true, an empty answer cannot be submitted. */
  required?: boolean;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  defaultValue?: string;
}

/**
 * A replacement for `window.prompt` that behaves like part of the application.
 *
 * The native prompt renders as a browser-chrome box captioned "localhost:5174
 * says", cannot be styled, has a single-line input that truncates a
 * paragraph-length message to the buyer, and blocks the whole page. None of
 * that is acceptable for text staff are sending to a customer.
 *
 * Built on the native `<dialog>` element rather than a hand-rolled overlay:
 * focus trapping, Escape-to-dismiss, inertness of the page behind, and
 * top-layer stacking are all provided by the platform. Reimplementing those is
 * where home-made modals usually get accessibility wrong.
 *
 * Returns a promise so the call sites read exactly as they did before:
 *
 *   const reason = await prompt({ ... });
 *   if (reason === null) return;   // dismissed
 */
export function usePromptDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState('');

  const prompt = useCallback((next: PromptOptions) => {
    setOptions(next);
    setValue(next.defaultValue ?? '');
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  // showModal() has to run after the dialog has rendered with its new content,
  // or the first open shows an empty box.
  useEffect(() => {
    if (options) ref.current?.showModal();
  }, [options]);

  /** Single exit point, so Escape and Cancel cannot resolve twice. */
  const settle = useCallback((result: string | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    ref.current?.close();
    setOptions(null);
    resolve?.(result);
  }, []);

  const dialog = (
    <dialog
      ref={ref}
      className="modal"
      // Fires for Escape as well as close(); settle() is idempotent.
      onCancel={(event) => {
        event.preventDefault();
        settle(null);
      }}
    >
      {options && (
        <form
          method="dialog"
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            settle(value);
          }}
        >
          <h2>{options.title}</h2>
          {options.message && <p className="modal-message">{options.message}</p>}

          <label>
            {options.label}
            {!options.required && <span className="optional"> (optional)</span>}
            <textarea
              value={value}
              rows={4}
              autoFocus
              required={options.required}
              placeholder={options.placeholder}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={() => settle(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${options.destructive ? 'btn-danger' : 'btn-primary'}`}
              disabled={options.required && value.trim() === ''}
            >
              {options.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );

  return { prompt, dialog };
}
