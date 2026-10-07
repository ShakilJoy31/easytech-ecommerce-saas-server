

// Gallery Fancyboxes images
// Fancybox Configuration
$('[data-fancybox="gallery"]').fancybox({
  buttons: ["slideShow", "thumbs", "zoom", "fullScreen", "share", "close"],
  loop: false,
  protect: true,
});

// Product Images
var currentImage;
var thumbnails, thumbnailButtons;

window.addEventListener("DOMContentLoaded", function (e) {
  currentImage = document.querySelector(".current-image");

  /**
    When Slick is initialized, grab the DOM nodes for the thumbnails and watch for user interactions.
  */
  $(".thumbnails").on("init", function (e, slick) {
    thumbnailButtons = document.querySelectorAll(
      ".thumbnails .thumbnail .thumbnail-button"
    );

    // Update the large image each time a thumbnail is activated
    thumbnailButtons.forEach(function (thumbnailButton) {
      thumbnailButton.addEventListener("click", function (e) {
        activateThumbnail(thumbnailButton);
      });
    });
  });

  /**
    Initialize Slick Slider with recommended configuration options
  */
  $(".thumbnails").slick({
    slidesToShow: 3,
    prevArrow:
      '<button class="previous-button button">' +
      '  <span class="fas fa-angle-left" aria-hidden="true"></span>' +
      '  <span class="sr-only">Previous slide</span>' +
      "</button>",
    nextArrow:
      '<button class="next-button button">' +
      '  <span class="fas fa-angle-right" aria-hidden="true"></span>' +
      '  <span class="sr-only">Next slide</span>' +
      "</button>",
    infinite: false,
    responsive: [
      {
        breakpoint: 300,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  });

  /**
    Update the large current image when a thumbnail button is activated.
  */
  function activateThumbnail(thumbnailButton) {
    // Swap the current image based to match the thumbnail
    // - If you'd like to use separate images, like higher-res versions, consider using the index to pick an appropriate src string from an array, or storing the URI of the higher-res image in a custom data attribute on the thumbnail.
    var newImageSrc = thumbnailButton.querySelector("img").getAttribute("src");
    var newImageAlt = thumbnailButton
      .querySelector("img")
      .getAttribute("data-full-alt");
    currentImage.querySelector("img").setAttribute("src", newImageSrc);
    currentImage.querySelector("img").setAttribute("alt", newImageAlt);

    // Remove aria-current from any previously-activated thumbnail
    thumbnailButtons.forEach(function (button) {
      button.removeAttribute("aria-current");
    });

    // Indicate to screen readers which thumbnail is selected using aria-current
    thumbnailButton.setAttribute("aria-current", true);
  }
});

function copyToClipboard(element) {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($(element).text()).select();
  document.execCommand("copy");
  $temp.remove();
}
