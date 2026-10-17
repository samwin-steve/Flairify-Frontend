"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string | null;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={"modal " + (wide ? "modal-wide" : "")}
          {...(description === null ? { "aria-describedby": undefined } : {})}
        >
          <div
            className={
              "modal-heading" + (description === null ? " modal-heading-compact" : "")
            }
          >
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description !== null && (
                <Dialog.Description>
                  {description || "Make this look your own."}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
