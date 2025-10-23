document.addEventListener("DOMContentLoaded", function() {
    const cards = document.querySelectorAll('.ProjectCarouselCard');
    cards.forEach(card => {
        const mainCard = card.querySelector('.mainCard'); // Select the mainCard directly within the current card
        if (mainCard) { // Ensure mainCard exists
            mainCard.addEventListener('click', function() {
                const modal = card.querySelector(".ProjectModal");
                if (modal) { // Ensure modal exists
                    openModal(modal);
                }
            });
        }
    });

    const modals = document.querySelectorAll('.ProjectModal');
    modals.forEach(modal => {
        const backdrop = modal.querySelector('.backdropPanel');
        if (backdrop) { // Add null check for backdrop
            backdrop.addEventListener('click', function() {
                closeModal(modal);
            });
        }

        // The actual close button is always bg-white
        const closeButton = modal.querySelector('button.bg-white');
        if (closeButton) { // Add null check
            closeButton.addEventListener('click', function() {
                closeModal(modal);
            });
        }

        // The first card has a hidden button.bg-blue-600 that acts as a close button.
        // New cards have a.bg-blue-600 for live demo, which should not close the modal.
        const hiddenDemoButton = modal.querySelector('button.bg-blue-600.d-none');
        if (hiddenDemoButton) { // Add null check
            hiddenDemoButton.addEventListener('click', () => closeModal(modal));
        }

        // The live demo link (a.bg-blue-600) should not close the modal, it navigates.
        // No event listener needed here for closing the modal.
    });
});

function openModal(modal) {
    const panel = modal.querySelector('.transform'); // Target the panel with the transform class
    modal.classList.remove('hidden'); // Show the modal container
    // Use a small timeout to allow the browser to render the modal before starting the transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (panel) panel.classList.remove('scale-0');
    }, 10);
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    const panel = modal.querySelector('.transform'); // Target the panel
    modal.classList.add('opacity-0'); // Start fading out the backdrop
    if (panel) panel.classList.add('scale-0'); // Start scaling down the panel

    // After transition, add 'hidden'
    // We listen on the panel as its transition is what we care about for hiding.
    panel.addEventListener('transitionend', function handler() {
        modal.classList.add('hidden');
        panel.removeEventListener('transitionend', handler); // Clean up the listener
    }, { once: true }); // Use { once: true } for modern browsers
    document.body.style.overflow = '';
}