
document.addEventListener('DOMContentLoaded', () => {
  const states = new WeakMap();
  const groupSelector =
    'fieldset.product-form__input, .product-form__input--dropdown';

  function getRoot(picker) {
    return picker.closest('product-info') ||
      picker.closest('.product') ||
      picker.closest('section');
  }

  function getState(picker) {
    const root = getRoot(picker);
    if (!states.has(root)) {
      states.set(root, { selected: new Set() });
    }
    return states.get(root);
  }

  function getGroups(picker) {
    return Array.from(picker.querySelectorAll(groupSelector));
  }

  function isComplete(picker) {
    const groups = getGroups(picker);
    const state = getState(picker);
    return groups.every((group, index) =>
      state.selected.has(index)
    );
  }

  function showPrompt(picker) {
    const groups = getGroups(picker);
    const state = getState(picker);

    const missingIndex = groups.findIndex(
      (group, index) => !state.selected.has(index)
    );

    const group = groups[missingIndex];
    const label = group?.querySelector('legend, .form__label');
    const name = label?.textContent.trim().replace(/:$/, '');

    alert(
      name
        ? `Please select ${name} before proceeding.`
        : 'Please select a product variant before proceeding.'
    );

    group?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    group?.querySelector('select, input[type="radio"]')?.focus();
  }

  function sync() {
    document.querySelectorAll('main variant-selects')
      .forEach((picker) => {
        const root = getRoot(picker);
        if (!root || !root.querySelector('product-form')) return;

        const groups = getGroups(picker);
        if (!groups.length) return;

        const state = getState(picker);

        groups.forEach((group, index) => {
          if (group.dataset.mandatoryReady) return;
          group.dataset.mandatoryReady = 'true';

          if (state.selected.has(index)) return;

          group.querySelectorAll('input[type="radio"]')
            .forEach((input) => {
              input.checked = false;
            });

          const select = group.querySelector('select');
          if (select) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Choose an option';
            option.disabled = true;
            select.prepend(option);
            select.value = '';
          }
        });

        const complete = isComplete(picker);

        root.querySelectorAll('.shopify-payment-button')
          .forEach((payment) => {
            let shield = payment.querySelector(
              '.mandatory-variant-shield'
            );

            if (complete) {
              shield?.remove();
              return;
            }

            if (!shield) {
              payment.style.position = 'relative';
              shield = document.createElement('div');
              shield.className = 'mandatory-variant-shield';
              shield.setAttribute('role', 'button');
              shield.setAttribute('tabindex', '0');
              shield.setAttribute(
                'aria-label',
                'Select product options before buying'
              );

              Object.assign(shield.style, {
                position: 'absolute',
                inset: '0',
                zIndex: '20',
                cursor: 'pointer'
              });

              shield.addEventListener('click', (event) => {
                event.preventDefault();
                showPrompt(picker);
              });

              shield.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  showPrompt(picker);
                }
              });

              payment.appendChild(shield);
            }
          });
      });
  }

  function pickerFor(element) {
    return Array.from(
      document.querySelectorAll('main variant-selects')
    ).find((picker) => getRoot(picker)?.contains(element));
  }

  document.addEventListener('click', (event) => {
    const picker = event.target.closest('variant-selects');

    if (picker) {
      const group = event.target.closest(groupSelector);
      if (group) {
        const radio = event.target.closest(
          'input[type="radio"]'
        );
        const label = event.target.closest('label');

        if (radio || (label && group.querySelector('input[type="radio"]'))) {
          getState(picker).selected.add(
            getGroups(picker).indexOf(group)
          );
          sync();
        }
      }
    }

    const addButton = event.target.closest(
      'product-form .product-form__submit'
    );

    if (addButton) {
      const productPicker = pickerFor(addButton);

      if (productPicker && !isComplete(productPicker)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showPrompt(productPicker);
      }
    }
  }, true);

  document.addEventListener('change', (event) => {
    const picker = event.target.closest('variant-selects');
    if (!picker) return;

    const group = event.target.closest(groupSelector);
    if (!group) return;

    getState(picker).selected.add(
      getGroups(picker).indexOf(group)
    );

    sync();
  }, true);

  document.addEventListener('submit', (event) => {
    if (!event.target.matches(
      'form[data-type="add-to-cart-form"]'
    )) return;

    const picker = pickerFor(event.target);

    if (picker && !isComplete(picker)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showPrompt(picker);
    }
  }, true);

  const main = document.querySelector('main');
  if (main) {
    new MutationObserver(sync).observe(main, {
      childList: true,
      subtree: true
    });
  }

  sync();
});
