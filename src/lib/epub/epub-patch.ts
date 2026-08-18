import { Rendition } from 'epubjs';

// Safe patches for epubjs Rendition to prevent crashes in React StrictMode & unmounts
if (typeof window !== 'undefined' && Rendition?.prototype) {
  const proto = Rendition.prototype as any;

  if (!proto._safePatched) {
    proto._safePatched = true;

    // 1. Destroy: clear queue so no trailing actions execute after unmount
    const originalDestroy = proto.destroy;
    if (originalDestroy) {
      proto.destroy = function () {
        if (this.q && typeof this.q.clear === 'function') {
          try {
            this.q.clear();
          } catch {}
        }
        return originalDestroy.call(this);
      };
    }

    // 2. Start: ALWAYS wait for book.ready so book.package, metadata & spine are guaranteed loaded before manager is created
    const originalStart = proto.start;
    if (originalStart) {
      proto.start = function () {
        if (!this.book) return Promise.resolve();
        const readyPromise = this.book.ready || this.book.opened;
        if (readyPromise) {
          return readyPromise.then(() => {
            if (!this.book) return;
            return originalStart.call(this);
          });
        }
        return originalStart.call(this);
      };
    }

    // 3. AttachTo: protect against unmounted manager
    const originalAttachTo = proto.attachTo;
    if (originalAttachTo) {
      proto.attachTo = function (element: HTMLElement) {
        return this.q.enqueue(
          function (this: any) {
            if (!this.manager || !this.book) return;
            this.manager.render(element, {
              width: this.settings.width,
              height: this.settings.height,
            });
            this.emit('attached');
          }.bind(this)
        );
      };
    }

    // 4. _display: protect against unmounted manager or book
    const originalDisplayInternal = proto._display;
    if (originalDisplayInternal) {
      proto._display = function (target: any) {
        if (!this.book || !this.manager) {
          return Promise.resolve();
        }
        return originalDisplayInternal.call(this, target);
      };
    }

    // 5. injectIdentifier: protect against missing packaging metadata
    const originalInject = proto.injectIdentifier;
    if (originalInject) {
      proto.injectIdentifier = function (doc: Document, section: any) {
        if (!this.book || !this.book.packaging) return;
        return originalInject.call(this, doc, section);
      };
    }
  }
}

export {};
