// all password input type toggle [type='text'/'password']
(() => {
  const all_password = document.querySelectorAll("input[type=password]");
  const all_password_toggle_btns =
    document.querySelectorAll(".toggle-password");
  all_password_toggle_btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const btn_target = btn?.dataset?.target;

      all_password.forEach((input) => {
        const input_target = input?.dataset?.target;
        if (btn_target === input_target) {
          if (input?.type === "password") {
            input.type = "text";
            btn.innerHTML = `<i class="fa-regular fa-eye"></i>`;
          } else {
            input.type = "password";
            btn.innerHTML = `<i class="fa-regular fa-eye-slash"></i>`;
          }
        }
      });
    });
  });
})();

// display date
const all_displayDateEle = document.querySelectorAll(".displayDateEle");
all_displayDateEle?.forEach((ele) => {
  const date = new Date(ele?.dataset?.date);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "June",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const theYear = date.getFullYear();
  const theMonth = date.getMonth();
  const theDate = date.getDate();
  ele.innerHTML = `${months[theMonth]} ${theDate} ${theYear}`;
});

function toggleTheme(theme = "") {
  if (theme) {
    document.querySelector("html").classList.add(theme);
  } else {
    document.querySelector("html").classList.toggle("dark");
  }

  if (theme === "dark") {
    document.querySelectorAll(".themeTogglerBtn").forEach(
      (btn) =>
      (btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
</svg>
`)
    );
  }
}

const all_themeTogglerBtn = document.querySelectorAll(".themeTogglerBtn");
all_themeTogglerBtn.forEach((btn) =>
  btn.addEventListener("click", () => {
    toggleTheme();
    const isDark = document.querySelector("html").classList.contains("dark");
    if (isDark) {
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
</svg>
`;
    } else {
      btn.innerHTML = `<i class="fa fa-moon"></i>`;
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  })
);

const theme = localStorage.getItem("theme");
if (theme) {
  toggleTheme(theme);
}

// DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  // saved theme
  const theme = localStorage.getItem("theme");
  if (theme) {
    toggleTheme(theme);
  }

  // error_message hidden
  setTimeout(() => {
    const all_error_messages = document.querySelectorAll(".error_message");
    all_error_messages.forEach((m) => (m.style.display = "none"));
  }, 20000);

  // toast-message
  const all_toast_messsages = document.querySelectorAll(".toast-message");
  all_toast_messsages.forEach((ele) => {
    setTimeout(() => {
      ele.style.display = "none";
    }, 4000);
  });
});

const all_calculateTime = document.querySelectorAll(".calculateTime");
all_calculateTime.forEach((element) => {
  const words = element?.dataset?.words;
  function calculateReadingTime(words) {
    var wordsPerMinute = 200;
    var minutes = words / wordsPerMinute;
    var roundedMinutes = Math.ceil(minutes);
    return roundedMinutes;
  }
  element.innerHTML = `${calculateReadingTime(words)}`;
});

const all_toggle_btns = document.querySelectorAll(".toggler_btn");
const all_toggle_opener = document.querySelectorAll(".toggler_opener");

all_toggle_btns.forEach((btn) => {
  const btn_target = btn.dataset?.target;
  all_toggle_opener.forEach((opener) => {
    const opener_target = opener.dataset?.target;
    let is_open = false;
    btn.addEventListener("click", () => {
      is_open = !is_open;
      if (btn_target === opener_target) {
        is_open
          ? (opener.style.display = "flex")
          : (opener.style.display = "none");
      }
    });
  });
});

const all_search_popup = document.querySelectorAll(".search-popup");
const all_search_popup_toggle = document.querySelectorAll(
  ".search-popup-toggle"
);

all_search_popup_toggle.forEach((btn) => {
  all_search_popup.forEach((opener) => {
    let is_open = false;
    btn.addEventListener("click", () => {
      is_open = !is_open;
      if (is_open) {
        opener.classList.remove("hidden");
        btn.innerHTML = '<i class="fa fa-times"></i>';
      } else {
        opener.classList.add("hidden");
        btn.innerHTML = '<i class="fa fa-search"></i>';
      }
    });
  });
});

const sidebar = document.getElementById("sidebar");
const sidebar_toggle = document.getElementById("sidebar_toggle");
const all_sidebar_remover = document.querySelectorAll(".sidebar_remover");

(() => {
  let open = false;

  sidebar_toggle.addEventListener("click", () => {
    open = !open;
    if (open) {
      sidebar.style.transform = `translateX(0%)`;
    } else {
      sidebar.style.transform = `translateX(-100%)`;
    }
  });

  all_sidebar_remover.forEach((b) => {
    b.addEventListener("click", () => {
      open = !open;
      sidebar.style.transform = `translateX(-100%)`;
    });
  });
})();



