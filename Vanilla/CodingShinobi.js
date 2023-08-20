document.addEventListener("DOMContentLoaded", function() {
    const cards = document.querySelectorAll('.ProjectCarouselCard');
    cards.forEach(card => {
        card.querySelectorAll('.mainCard').forEach(mainCard => {
                mainCard.addEventListener('click', function() {
                const modalID = card.getAttribute('data-modal-target');
                const modal = card.querySelector(".ProjectModal");
                //console.log(modal);
                openModal(modal);
            });
        });
    });

    const modals = document.querySelectorAll('.ProjectModal');
    modals.forEach(modal => {
        const backdrop = modal.querySelector('.backdropPanel');
        console.log(backdrop);
        backdrop.addEventListener('click', function() {
            
            closeModal(modal);
        });

        const deactivateButton = modal.querySelector('button.bg-blue-600');
        const cancelButton = modal.querySelector('button.bg-white');
        
        [deactivateButton, cancelButton].forEach(button => {
            button.addEventListener('click', function() {
                //console.log(modal);
                closeModal(modal);
            });
        });
    });
});

function openModal(modal) {
    modal.classList.remove('hidden');
    modal.style.opacity = 100;
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.add('hidden');
    modal.style.opacity = 0;
    document.body.style.overflow = '';
}