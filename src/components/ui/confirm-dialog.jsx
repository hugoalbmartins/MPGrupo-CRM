import React, { useState, useCallback, useRef } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmar", confirmVariant = "destructive", onConfirm, onCancel }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-dark-850 border border-white/[0.08] text-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-base">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-slate-400 text-sm">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="border-dark-700 text-slate-300 hover:bg-dark-700">
            Cancelar
          </Button>
          <Button
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            className={confirmVariant !== "destructive" ? "bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800" : ""}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState({ open: false, title: "", description: "", confirmLabel: "Confirmar", confirmVariant: "destructive" });
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, description, confirmLabel, confirmVariant } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, title: title || "Tem a certeza?", description: description || "", confirmLabel: confirmLabel || "Confirmar", confirmVariant: confirmVariant || "destructive" });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);

  const close = useCallback((value = false) => {
    setState(s => ({ ...s, open: false }));
    resolveRef.current?.(value);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      confirmVariant={state.confirmVariant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, dialog, close };
}
