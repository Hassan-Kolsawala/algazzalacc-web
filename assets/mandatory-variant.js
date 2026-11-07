
(() => {
  const GROUP =
    'fieldset.product-form__input, .product-form__input--dropdown';

  // Reset after each purchase attempt.
  const RESET_DELAY_MS = 1200;

  const store = new WeakMap();

  function rootOf(picker) {
    return picker.closest('product-info') ||
      picker.closest('.product') ||
      picker.closest('section');
  }

  function stateOf(picker) {
    const root = rootOf(picker);

    if (!store.has(root)) {
      store.set(root, {
        chosen: new Set(),
        attempted: false,
        purchasePending: false,
        purchaseSource: null,
        resetTimer: null
      });
    }

    return store.get(root);
  }

  function groupsOf(picker) {
    return [...picker.querySelectorAll(GROUP)];
  }

  function optionName(group) {
    const label = group.querySelector(
      'legend, .form__label'
    );

    if (!label) return 'an option';

    const copy = label.cloneNode(true);

    copy.querySelectorAll(
      '[data-selected-value], .mvs-required'
    ).forEach(el => el.remove());

    return copy.textContent.trim()
      .replace(/:$/, '') || 'an option';
  }

  function allChosen(picker) {
    const groups = groupsOf(picker);
    const state = stateOf(picker);

    return groups.length > 0 &&
      groups.every((_, i) => state.chosen.has(i));
  }

  function valid(picker) {
    return !stateOf(picker).purchasePending &&
      allChosen(picker);
  }

  function initializeGroup(group, chosen) {
    if (!group.dataset.mvsReady) {
      group.dataset.mvsReady = '1';

      const label = group.querySelector(
        'legend, .form__label'
      );

      if (label && !label.querySelector(
        '.mvs-required'
      )) {
        const mark = document.createElement('span');
        mark.className = 'mvs-required';
        mark.textContent = ' * Required';
        label.appendChild(mark);
      }

      const hint = document.createElement('div');
      hint.className = 'mvs-hint';
      hint.setAttribute('role', 'status');
      hint.setAttribute('aria-live', 'polite');

      group.insertAdjacentElement('afterend', hint);
    }

    if (!chosen) {
      group.querySelectorAll(
        'input[type="radio"]:checked'
      ).forEach(input => {
        input.checked = false;
      });

      const select = group.querySelector('select');

      if (select) {
        if (![...select.options].some(
          option => option.value === ''
        )) {
          const placeholder = new Option(
            `Select ${optionName(group)}`,
            '',
            true,
            true
          );

          placeholder.disabled = true;

          select.insertBefore(
            placeholder,
            select.firstChild
          );
        }

        select.value = '';
      }

      const selectedText = group.querySelector(
        'legend [data-selected-value]'
      );

      if (
        selectedText &&
        selectedText.textContent !== 'Choose'
      ) {
        selectedText.textContent = 'Choose';
      }
    }
  }

  function makeGate(
    holder, original, className, label, onClick
  ) {
    let gate = holder.querySelector(
      `.${className.split(' ')[0]}`
    );

    if (!gate) {
      gate = document.createElement('button');
      gate.type = 'button';
      gate.className = className;
      gate.textContent = label;

      gate.addEventListener('click', onClick);

      original.insertAdjacentElement(
        'afterend',
        gate
      );
    }

    return gate;
  }

  function syncPicker(picker) {
    const root = rootOf(picker);

    if (!root || !root.querySelector(
      'product-form'
    )) return;

    const state = stateOf(picker);
    const groups = groupsOf(picker);

    if (!groups.length) return;

    groups.forEach((group, i) => {
      initializeGroup(
        group,
        state.chosen.has(i)
      );
    });

    const missing = groups.findIndex(
      (_, i) => !state.chosen.has(i)
    );

    groups.forEach((group, i) => {
      const hint = group.nextElementSibling;

      if (!hint?.classList.contains(
        'mvs-hint'
      )) return;

      const needsChoice = !state.chosen.has(i);

      const error =
        state.attempted && i === missing;

      group.classList.toggle(
        'mvs-error',
        error
      );

      hint.classList.toggle(
        'mvs-hint-error',
        error
      );

      hint.hidden = !needsChoice;

      const message = error
        ? `↑ Select ${optionName(group)} here before continuing.`
        : `Choose ${optionName(group)} to continue`;

      if (hint.textContent !== message) {
        hint.textContent = message;
      }
    });

    const complete =
      missing === -1 &&
      !state.purchasePending;

    // ADD TO CART BUTTON
    const add = root.querySelector(
      'product-form .product-form__submit'
    );

    if (add?.parentElement) {
      const holder = add.parentElement;

      makeGate(
        holder,
        add,
        'mvs-add-gate product-form__submit button button--full-width button--primary',
        'Add to cart',
        () => guide(picker)
      );

      holder.classList.toggle(
        'mvs-add-locked',
        !complete
      );
    }

    // BUY IT NOW BUTTON
    const payment = root.querySelector(
      '.shopify-payment-button'
    );

    if (payment) {
      if (!payment.querySelector(
        '.mvs-buy-gate'
      )) {
        const gate = document.createElement(
          'button'
        );

        gate.type = 'button';
        gate.className = 'mvs-buy-gate';
        gate.textContent = 'Buy it now';

        gate.addEventListener(
          'click',
          () => guide(picker)
        );

        payment.appendChild(gate);
      }

      payment.classList.toggle(
        'mvs-buy-locked',
        !complete
      );
    }
  }

  function guide(picker) {
    const state = stateOf(picker);

    // Prevent another purchase while the
    // previous purchase attempt is processing.
    if (state.purchasePending) return;

    state.attempted = true;

    syncPicker(picker);

    const missing = groupsOf(picker).find(
      (_, i) => !state.chosen.has(i)
    );

    if (!missing) return;

    missing.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    const focusTarget = missing.querySelector(
      'select, input[type="radio"]:not(:disabled)'
    );

    focusTarget?.focus({
      preventScroll: true
    });
  }

  function pickerFor(element) {
    return [
      ...document.querySelectorAll(
        'main variant-selects'
      )
    ].find(
      picker => rootOf(picker)?.contains(element)
    );
  }

  /* =========================================
     AUTOMATIC RESET AFTER EVERY PURCHASE
     ========================================= */

  function startPurchase(picker, source) {
    if (!valid(picker)) return;

    const state = stateOf(picker);

    // Lock both buttons immediately.
    state.purchasePending = true;
    state.purchaseSource = source;

    // Allow Shopify to begin processing
    // the currently selected variant.
    setTimeout(() => {
      if (picker.isConnected) {
        syncPicker(picker);
      }
    }, 0);

    clearTimeout(state.resetTimer);

    // Clear the previous selection after
    // Shopify has started the purchase.
    state.resetTimer = setTimeout(() => {
      state.chosen.clear();
      state.attempted = false;
      state.purchasePending = false;
      state.purchaseSource = null;
      state.resetTimer = null;

      // Restore initial mandatory-selection
      // state without reloading the page.
      if (picker.isConnected) {
        syncPicker(picker);
      }
    }, RESET_DELAY_MS);
  }

  /* =========================================
     DETECT CUSTOMER VARIANT SELECTION
     ========================================= */

  document.addEventListener(
    'change',
    event => {
      const picker = event.target.closest?.(
        'variant-selects'
      );

      if (!picker) return;

      const group = event.target.closest(GROUP);

      const index = groupsOf(picker).indexOf(
        group
      );

      if (index < 0) return;

      const state = stateOf(picker);

      if (event.target.value) {
        state.chosen.add(index);
      } else {
        state.chosen.delete(index);
      }

      if (valid(picker)) {
        state.attempted = false;
      }

      syncPicker(picker);
    },
    true
  );

  /* =========================================
     ADD TO CART + BUY IT NOW CLICK HANDLING
     ========================================= */

  document.addEventListener(
    'click',
    event => {
      const add = event.target.closest?.(
        'product-form .product-form__submit:not(.mvs-add-gate)'
      );

      // Block original Add to Cart when
      // options are not freshly selected.
      if (add) {
        const picker = pickerFor(add);

        if (picker && !valid(picker)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          guide(picker);
        }

        return;
      }

      // Our guidance button already has
      // its own click handler.
      if (event.target.closest?.(
        '.mvs-buy-gate'
      )) return;

      // Find Shopify accelerated checkout.
      const path = event.composedPath?.() || [];

      const payment =
        event.target.closest?.(
          '.shopify-payment-button'
        ) ||
        path.find(node =>
          node?.matches?.(
            '.shopify-payment-button'
          )
        );

      if (!payment) return;

      const picker = pickerFor(payment);

      if (!picker) return;

      if (!valid(picker)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        guide(picker);
        return;
      }

      // Valid Buy It Now purchase attempt.
      startPurchase(picker, 'buy');
    },
    true
  );

  /* =========================================
     ADD TO CART FORM SUBMISSION
     ========================================= */

  document.addEventListener(
    'submit',
    event => {
      if (!event.target.matches(
        'form[data-type="add-to-cart-form"]'
      )) return;

      const picker = pickerFor(event.target);

      if (!picker) return;

      const state = stateOf(picker);

      // Buy It Now can submit this same form.
      // Allow its already-authorized checkout
      // to continue normally.
      if (
        state.purchasePending &&
        state.purchaseSource === 'buy'
      ) return;

      // Refuse cart submission if the customer
      // has not made a fresh selection.
      if (!valid(picker)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        guide(picker);
        return;
      }

      // Valid Add to Cart purchase attempt.
      startPurchase(picker, 'add');
    },
    true
  );

  /* =========================================
     INITIALIZE AND MONITOR PRODUCT PAGE
     ========================================= */

  function syncAll() {
    document.querySelectorAll(
      'main variant-selects'
    ).forEach(syncPicker);
  }

  function resetAll() {
    document.querySelectorAll(
      'main variant-selects'
    ).forEach(picker => {
      const state = stateOf(picker);

      clearTimeout(state.resetTimer);

      state.resetTimer = null;
      state.chosen.clear();
      state.attempted = false;
      state.purchasePending = false;
      state.purchaseSource = null;

      syncPicker(picker);
    });
  }

  // Require selection again when customers
  // return using browser Back navigation.
  window.addEventListener(
    'pageshow',
    event => {
      if (event.persisted) {
        resetAll();
      }
    }
  );

  function start() {
    syncAll();

    let queued = false;

    const observer = new MutationObserver(() => {
      if (queued) return;

      queued = true;

      requestAnimationFrame(() => {
        queued = false;
        syncAll();
      });
    });

    observer.observe(
      document.querySelector('main') ||
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start
    );
  } else {
    start();
  }
})();
