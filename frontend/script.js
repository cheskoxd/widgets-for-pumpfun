document.querySelectorAll('.dummy-widget').forEach(widget => {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    const desktop = document.getElementById('desktop-container');

    widget.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resizer')) {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = widget.offsetWidth;
            startHeight = widget.offsetHeight;
        } else {
            isDragging = true;
            startX = e.clientX - widget.offsetLeft;
            startY = e.clientY - widget.offsetTop;
        }
        widget.style.zIndex = 100;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            let left = e.clientX - startX;
            let top = e.clientY - startY;

            // Contain within desktop
            left = Math.max(0, Math.min(left, desktop.offsetWidth - widget.offsetWidth));
            top = Math.max(0, Math.min(top, desktop.offsetHeight - widget.offsetHeight));

            widget.style.left = left + 'px';
            widget.style.top = top + 'px';
        }

        if (isResizing) {
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);

            if (width > 120) widget.style.width = width + 'px';
            if (height > 60) widget.style.height = height + 'px';

            // Scale internal font based on width (mirroring the app logic)
            const scale = width / 280;
            widget.style.fontSize = (1 * scale) + 'rem';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        widget.style.zIndex = 1;
    });
});
