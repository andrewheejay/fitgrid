import { Outlet } from '@tanstack/react-router';
import { useState } from 'react';
import { Header } from '~/components/Header';
import { ResetDialog } from '~/components/ResetDialog';
import { useWardrobe } from '~/store/wardrobeStore';

export function App() {
  const [resetOpen, setResetOpen] = useState(false);
  const overlay = useWardrobe((state) => state.overlay);
  const reset = useWardrobe((state) => state.reset);

  return (
    <>
      <Header onReset={() => setResetOpen(true)} />
      <Outlet />
      <ResetDialog
        open={resetOpen}
        addedCount={overlay.addedItems.length}
        savedCount={overlay.savedOutfits.length}
        onConfirm={() => {
          reset();
          setResetOpen(false);
        }}
        onCancel={() => setResetOpen(false)}
      />
    </>
  );
}
