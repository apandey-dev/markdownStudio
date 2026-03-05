/* js/ui/sidebar.js */
const SidebarManager = {
    init() {
        this.sidebarOverlay = document.getElementById('mobile-sidebar-overlay');
        this.setupEventListeners();
    },

    setupEventListeners() {
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => this.sidebarOverlay?.classList.add('show'));
        document.getElementById('close-sidebar-btn')?.addEventListener('click', () => this.sidebarOverlay?.classList.remove('show'));

        this.sidebarOverlay?.addEventListener('click', (e) => {
            if (e.target === this.sidebarOverlay) this.sidebarOverlay.classList.remove('show');
        });

        document.getElementById('sidebar-btn-docs-mobile')?.addEventListener('click', () => {
            this.sidebarOverlay?.classList.remove('show');
            document.getElementById('docs-modal')?.classList.add('show');
        });

        document.getElementById('sidebar-btn-share')?.addEventListener('click', () => {
            this.sidebarOverlay?.classList.remove('show');
            document.getElementById('btn-share')?.click();
        });

        document.getElementById('sidebar-btn-pdf')?.addEventListener('click', () => {
            this.sidebarOverlay?.classList.remove('show');
            document.getElementById('btn-pdf')?.click();
        });
    },

    close() {
        this.sidebarOverlay?.classList.remove('show');
    }
};

export default SidebarManager;
