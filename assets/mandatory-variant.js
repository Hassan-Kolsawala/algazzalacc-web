
(() => {
  const GROUP =
    'fieldset.product-form__input, .product-form__input--dropdown';

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

  /* =========================================
     ENSURE VARIANT LABEL AND WARNING EXIST
     ========================================= */

  function ensureGroup(group, chosen) {
    const label = group.querySelector(
      'legend, .form__label'
    );

    // Restore required label if Shopify
    // has updated the product section.
    if (
      label &&
      !label.querySelector('.mvs-required')
    ) {
      const required = document.createElement(
        'span'
      );

      required.className = 'mvs-required';
      required.textContent = ' * Required';

      label.appendChild(required);
    }

    // IMPORTANT FIX:
    // Check the warning element every time,
    // not just when the page first loads.
    let hint = group.nextElementSibling;

    if (!hint?.classList.contains('mvs-hint')) {
      hint = document.createElement('div');

      hint.className = 'mvs-hint';

      hint.setAttribute(
        'role',
        'status'
      );

      hint.setAttribute(
        'aria-live',
        'polite'
      );

      group.insertAdjacentElement(
        'afterend',
        hint
      );
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

      const chosenText = group.querySelector(
        'legend [data-selected-value]'
      );

      if (
        chosenText &&
        chosenText.textContent !== 'Choose'
      ) {
        chosenText.textContent = 'Choose';
      }
    }

    return hint;
  }

  /* =========================================
     PURCHASE BUTTON GUIDANCE
     ========================================= */

  function ensureGate(
    holder,
    original,
    className,
    label
  ) {
    const singleClass = className.split(' ')[0];

    let gate = holder.querySelector(
      `.${singleClass}`
    );

    if (!gate) {
      gate = document.createElement('button');

      gate.type = 'button';
      gate.className = className;
      gate.textContent = label;

      original.insertAdjacentElement(
        'afterend',
        gate
      );
    }

    return gate;
  }

  function syncPicker(picker) {
    const root = rootOf(picker);

    if (
      !root ||
      !root.querySelector('product-form')
    ) return;

    const state = stateOf(picker);
    const groups = groupsOf(picker);

    if (!groups.length) return;

    const missing = groups.findIndex(
      (_, i) => !state.chosen.has(i)
    );

    groups.forEach((group, i) => {
      const hint = ensureGroup(
        group,
        state.chosen.has(i)
      );

      const needsChoice =
        !state.chosen.has(i);

      // Show red warning only after an
      // invalid purchase-button click.
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

    // ADD TO CART
    const add = root.querySelector(
      'product-form .product-form__submit:not(.mvs-add-gate)'
    );

    if (add?.parentElement) {
      const holder = add.parentElement;

      ensureGate(
        holder,
        add,
        'mvs-add-gate product-form__submit button button--full-width button--primary',
        'Add to cart'
      );

      holder.classList.toggle(
        'mvs-add-locked',
        !complete
      );
    }

    // BUY IT NOW
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

        payment.appendChild(gate);
      }

      payment.classList.toggle(
        'mvs-buy-locked',
        !complete
      );
    }
  }

  /* =========================================
     SHOW RED WARNING ON EVERY INVALID CLICK
     ========================================= */

  function guide(picker) {
    const state = stateOf(picker);

    if (state.purchasePending) return;

    // Activate warning for THIS click.
    state.attempted = true;

    // Rebuild/refresh warning if necessary.
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
     RESET AFTER EVERY PURCHASE
     ========================================= */

  function startPurchase(picker, source) {
    if (!valid(picker)) return;

    const state = stateOf(picker);

    state.purchasePending = true;
    state.purchaseSource = source;

    setTimeout(() => {
      if (picker.isConnected) {
        syncPicker(picker);
      }
    }, 0);

    clearTimeout(state.resetTimer);

    state.resetTimer = setTimeout(() => {
      // Require a new selection.
      state.chosen.clear();

      // IMPORTANT:
      // Reset warning to hidden.
      // The next invalid button click will
      // activate it again.
      state.attempted = false;

      state.purchasePending = false;
      state.purchaseSource = null;
      state.resetTimer = null;

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

      const group = event.target.closest(
        GROUP
      );

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
     HANDLE EVERY ADD TO CART / BUY NOW CLICK
     ========================================= */

  // Delegated listener keeps working even
  // if Shopify recreates purchase buttons.
  document.addEventListener(
    'click',
    event => {
      const guideButton = event.target.closest?.(
        '.mvs-add-gate, .mvs-buy-gate'
      );

      // CUSTOMER CLICKS A LOCKED BUTTON
      if (guideButton) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const picker = pickerFor(guideButton);

        if (picker) {
          guide(picker);
        }

        return;
      }

      // ORIGINAL ADD TO CART BUTTON
      const add = event.target.closest?.(
        'product-form .product-form__submit:not(.mvs-add-gate)'
      );

      if (add) {
        const picker = pickerFor(add);

        if (picker && !valid(picker)) {
          event.preventDefault();
          event.stopImmediatePropagation();

          guide(picker);
        }

        return;
      }

      // ORIGINAL BUY IT NOW BUTTON
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

      if (
        state.purchasePending &&
        state.purchaseSource === 'buy'
      ) return;

      if (!valid(picker)) {
        event.preventDefault();
        event.stopImmediatePropagation();

        guide(picker);
        return;
      }

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

      // Return silently without warning.
      state.attempted = false;

      state.purchasePending = false;
      state.purchaseSource = null;

      syncPicker(picker);
    });
  }

  // Reset after browser Back navigation.
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

    // Monitor Shopify's dynamic product
    // updates and restore warning elements.
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
