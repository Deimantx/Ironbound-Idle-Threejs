import { useEffect, useRef, type RefObject } from 'react';
import { InventoryItemDetails, type InventoryItemDetailsProps } from './InventoryItemDetails';

export interface InventoryDetailsDrawerProps extends Omit<InventoryItemDetailsProps, 'headingId'> {
  open: boolean;
  headingId: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function InventoryDetailsDrawer({
  open,
  headingId,
  returnFocusRef,
  onClose,
  stack,
  item,
  onEquip,
  onOpenEquipment,
  onToggleLock,
  onDestroyOne,
}: InventoryDetailsDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocusElement = returnFocusRef.current;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      (returnFocusElement ?? previousFocus)?.focus();
    };
  }, [open, returnFocusRef]);

  if (!open || !stack) return null;

  return (
    <div
      className="inventory-details-drawer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="inventory-drawer-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="inventory-drawer-header">
          <div className="eyebrow">Item details</div>
          <button
            type="button"
            className="button ghost"
            onClick={onClose}
            aria-label="Close item details"
          >
            Close
          </button>
        </div>
        <div className="inventory-drawer-content">
          <InventoryItemDetails
            stack={stack}
            item={item}
            headingId={headingId}
            onEquip={onEquip}
            onOpenEquipment={onOpenEquipment}
            onToggleLock={onToggleLock}
            onDestroyOne={onDestroyOne}
          />
        </div>
      </section>
    </div>
  );
}
