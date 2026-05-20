// Search functionality for filtering chapters
if (typeof document !== 'undefined') {
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-chapters');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterChapters(searchTerm);
        });

        // Clear search on Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                filterChapters('');
            }
        });
    }
});

function filterChapters(searchTerm) {
    const navButtons = document.querySelectorAll('.nav-btn');
    const partHeaders = document.querySelectorAll('.nav-part-header');
    
    let visibleCount = 0;
    
    navButtons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        const matches = text.includes(searchTerm);
        
        if (matches) {
            btn.style.display = 'block';
            btn.classList.add('highlight-match');
            visibleCount++;
        } else {
            btn.style.display = 'none';
            btn.classList.remove('highlight-match');
        }
    });

    // Show/hide part headers based on whether any chapters in that part are visible
    partHeaders.forEach((header, index) => {
        const nextHeader = partHeaders[index + 1];
        const startIdx = Array.from(navButtons).indexOf(
            Array.from(navButtons).find(btn => btn.style.display !== 'none' && 
                btn.parentNode.children[Array.from(partHeaders).indexOf(header)] === undefined)
        );
        
        let hasVisibleChild = false;
        let sibling = header.nextElementSibling;
        
        while (sibling && sibling !== nextHeader && !sibling.classList.contains('nav-part-header')) {
            if (sibling.classList.contains('nav-btn') && sibling.style.display !== 'none') {
                hasVisibleChild = true;
                break;
            }
            sibling = sibling.nextElementSibling;
        }
        
        header.style.display = hasVisibleChild || searchTerm === '' ? 'block' : 'none';
    });

    // Show message if no chapters found
    const nav = document.getElementById('chapter-nav');
    if (visibleCount === 0 && searchTerm !== '') {
        if (!document.getElementById('no-results-msg')) {
            const msg = document.createElement('div');
            msg.id = 'no-results-msg';
            msg.style.cssText = 'padding: 1rem; text-align: center; color: #999; font-size: 0.9rem;';
            msg.textContent = '❌ No chapters found';
            nav.appendChild(msg);
        }
    } else {
        const msg = document.getElementById('no-results-msg');
        if (msg) msg.remove();
    }
}

// Highlight matching text (optional enhancement)
function highlightSearchResults(searchTerm) {
    if (searchTerm === '') return;
    
    const navButtons = document.querySelectorAll('.nav-btn:not([style*="display: none"])');
    navButtons.forEach(btn => {
        const text = btn.textContent;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        btn.innerHTML = text.replace(regex, '<mark>$1</mark>');
    });
}

// Add highlight styling to CSS dynamically if needed
if (typeof document !== 'undefined') {
const style = document.createElement('style');
style.textContent = `
    .nav-btn.highlight-match {
        background-color: rgba(201, 122, 92, 0.2);
        color: #c97a5c;
    }
    
    mark {
        background-color: rgba(201, 122, 92, 0.3);
        padding: 0 2px;
        border-radius: 2px;
    }
    
    #no-results-msg {
        animation: slideInDown 0.3s ease;
    }
`;
document.head.appendChild(style);
}
