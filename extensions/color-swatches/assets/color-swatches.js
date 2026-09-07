document.addEventListener('click', function (e) {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;

  const wrapper = swatch.closest('.color-swatches');
  wrapper.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('is-active'));
  swatch.classList.add('is-active');

  const newSrc = swatch.getAttribute('data-image');
  if (!newSrc) return;

  const img = document.querySelector(
    '.product__media img, .product-single__photo img, [data-main-image] img, .product__main-photos img'
  );

  if (!img) {
    console.warn('[color-swatches] Could not find main product image element.');
    return;
  }

  img.src = newSrc;
  img.removeAttribute('srcset');
});