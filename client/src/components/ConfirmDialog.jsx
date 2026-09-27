import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(() => Promise.resolve(false));

// A native <dialog> for confirming actions. Focus starts on the safe (cancel)
// button, Esc closes it, and focus returns to whatever opened it.
//   const confirm = useConfirm();
//   if (await confirm({ title, body, confirmLabel, danger: true })) { ... }
export function ConfirmProvider({ children }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const resolveRef = useRef(null);
  const openerRef = useRef(null);
  const [options, setOptions] = useState(null);

  const confirm = useCallback((opts) => {
    openerRef.current = document.activeElement;
    setOptions(opts);
    // Wait for the content to render before opening.
    requestAnimationFrame(() => {
      dialogRef.current?.showModal();
      cancelRef.current?.focus();
    });
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleClose() {
    const confirmed = dialogRef.current.returnValue === 'ok';
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    // If the action removed the opener, the page moves focus itself.
    if (openerRef.current?.isConnected) openerRef.current.focus();
  }

  function handleBackdropClick(event) {
    if (event.target === dialogRef.current) dialogRef.current.close('');
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="dlg-title"
        aria-describedby="dlg-body"
        onClose={handleClose}
        onClick={handleBackdropClick}
      >
        {options && (
          <form method="dialog" className="dlg-inner">
            <h2 id="dlg-title">{options.title}</h2>
            <p id="dlg-body">{options.body}</p>
            <div className="dlg-actions">
              <button ref={cancelRef} className="btn btn-secondary" value="cancel">
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`} value="ok">
                {options.confirmLabel}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
