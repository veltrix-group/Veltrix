
document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // VELTRIX — Main JavaScript
  // ==========================================

  const body = document.body;
  const header = document.querySelector("[data-site-header]");

  // ------------------------------------------
  // 1. Automatisches Jahr im Footer
  // ------------------------------------------

  const yearElements = document.querySelectorAll("[data-current-year]");

  yearElements.forEach((element) => {
    element.textContent = new Date().getFullYear();
  });


  // ------------------------------------------
  // 2. Mobile Navigation
  // ------------------------------------------

  const menuToggle = document.querySelector("[data-menu-toggle]");
  const siteNav = document.querySelector("[data-site-nav]");

  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.classList.toggle("is-open");

      siteNav.classList.toggle("is-open", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      body.classList.toggle("menu-open", isOpen);
    });

    // Navigation nach Auswahl eines Links schließen
    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("is-open");
        siteNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        body.classList.remove("menu-open");
      });
    });
  }


  // ------------------------------------------
  // 3. Header beim Scrollen
  // ------------------------------------------

  const updateHeader = () => {
    if (!header) return;

    header.classList.toggle("is-scrolled", window.scrollY > 20);
  };

  updateHeader();

  window.addEventListener("scroll", updateHeader, {
    passive: true
  });


  // ------------------------------------------
  // 4. Reveal-Animationen
  // ------------------------------------------

  const revealElements = document.querySelectorAll("[data-reveal]");

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => {
      element.classList.add("is-visible");
    });
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    revealElements.forEach((element) => {
      element.classList.add("will-reveal");
      revealObserver.observe(element);
    });
  }


  // ------------------------------------------
  // 5. Smooth Scrolling für interne Links
  // ------------------------------------------

  const internalLinks = document.querySelectorAll('a[href^="#"]');

  internalLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  });


  // ------------------------------------------
  // 6. FAQ Accordion
  // ------------------------------------------

  const accordionGroups = document.querySelectorAll("[data-accordion]");

  accordionGroups.forEach((group) => {
    const items = group.querySelectorAll("[data-accordion-item]");

    items.forEach((item) => {
      const trigger = item.querySelector("[data-accordion-trigger]");
      const panel = item.querySelector("[data-accordion-panel]");

      if (!trigger || !panel) return;

      trigger.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");

        // Andere offene Fragen schließen
        items.forEach((otherItem) => {
          const otherTrigger = otherItem.querySelector(
            "[data-accordion-trigger]"
          );

          const otherPanel = otherItem.querySelector(
            "[data-accordion-panel]"
          );

          otherItem.classList.remove("is-open");

          if (otherTrigger) {
            otherTrigger.setAttribute("aria-expanded", "false");
          }

          if (otherPanel) {
            otherPanel.hidden = true;
          }
        });

        // Ausgewählte Frage öffnen
        if (!isOpen) {
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          panel.hidden = false;
        }
      });
    });
  });


  // ------------------------------------------
  // 7. Copy-to-Clipboard
  // ------------------------------------------

  const copyButtons = document.querySelectorAll("[data-copy]");

  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const textToCopy = button.getAttribute("data-copy");

      if (!textToCopy || !navigator.clipboard) return;

      try {
        await navigator.clipboard.writeText(textToCopy);

        const originalText = button.textContent;

        button.textContent = "Kopiert!";
        button.classList.add("is-copied");

        window.setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("is-copied");
        }, 1800);

      } catch (error) {
        console.error("VELTRIX: Kopieren fehlgeschlagen.", error);
      }
    });
  });


  // ------------------------------------------
  // 8. Initialisierung abgeschlossen
  // ------------------------------------------

  document.documentElement.classList.add("js-ready");

  console.info("VELTRIX website initialized.");

});
