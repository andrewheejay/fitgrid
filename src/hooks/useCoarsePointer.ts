import { useEffect, useState } from 'react';

/**
 * Whether the visitor is pointing with a finger rather than a mouse.
 *
 * This is a behavioural question, not a width one, which is why it is a media
 * query on the pointer and not on the viewport: a narrow desktop window still
 * has a cursor that can double-click, and a tablet held in landscape is 1024px
 * wide and still cannot. The one gesture this decides — double-click versus tap
 * — has no coarse-pointer equivalent at all, so guessing it from width would
 * strand real people.
 *
 * Read in an effect rather than during render because matchMedia does not exist
 * while the component tree is being built on the server or in a test's node
 * environment. False is the honest first answer: the desktop path also works
 * under a finger, it is only slower, whereas opening a field on every stray tap
 * where a mouse exists would make the text unreadable.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(query.matches);
    sync();
    // Not a fixed property of the device: a tablet gains a fine pointer the
    // moment a keyboard case is attached, and loses it again when it comes off.
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return coarse;
}
