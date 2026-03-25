import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { SlimeInteractionEngine } from './slime-interaction-engine.js';
import { loadSession, normalizePanelLayout } from './prairie-session.js';
import { MIN_ZOOM, MAX_ZOOM, MAX_ACTIVE_TRUE_ENGINE, clamp } from './prairie-constants.js';

export function createPrairieContext() {
    const session = loadSession();
    
    return {
        // Services
        storageContext: getStorageRuntimeContext(),
        interactionEngine: new SlimeInteractionEngine(),
        
        // DOM Elements
        root: null,
        viewport: null,
        scene: null,
        canvas: null,
        minimapCanvas: null,
        droneToggle: null,
        dronePanel: null,
        droneClose: null,
        dronePanelDragHandle: null,
        dronePanelResizeHandle: null,
        droneTeamGrid: null,
        droneArchiveGrid: null,
        droneCap: null,
        droneArchiveHint: null,
        emptyState: null,
        loupeBtn: null,
        obsPanel: null,
        obsClose: null,
        obsTitle: null,
        obsHint: null,
        obsBody: null,
        obsPageLog: null,
        obsPageStats: null,
        obsPageJournal: null,
        obsTabs: [],
        obsDragHandle: null,
        
        // Observers / Subscriptions / IDs
        resizeObserver: null,
        unsubscribeRepository: null,
        currentMount: null,
        rafId: 0,
        backgroundTickId: 0,
        saveTimeout: 0,
        dronePanelCloseTimeout: 0,
        obsUpdateInterval: 0,
        
        // Core State
        isSuspended: false,
        interactionsBound: false,
        session: session,
        panelLayout: normalizePanelLayout(session.panel || {}),
        
        camera: {
            x: Number.isFinite(session.camera?.x) ? session.camera.x : 0,
            y: Number.isFinite(session.camera?.y) ? session.camera.y : 0,
            zoom: Number.isFinite(session.camera?.zoom) ? clamp(session.camera.zoom, MIN_ZOOM, MAX_ZOOM) : 1,
        },
        world: { width: 1440, height: 920, groundY: 720, left: 40, top: 68, right: 1400, bottom: 720 },
        activeCanonicalIds: Array.isArray(session.activeCanonicalIds)
            ? session.activeCanonicalIds.filter((value, index, source) => typeof value === 'string' && value && source.indexOf(value) === index).slice(0, MAX_ACTIVE_TRUE_ENGINE)
            : [],
        runtimeById: new Map(),
        
        // Interactions / Pointers
        pointers: new Map(),
        pointerMode: 'idle',
        panAnchor: null,
        pinchAnchor: null,
        activeDrag: null,
        edgeScrollPointer: null,
        viewportEdgeRect: null,
        panelDrag: null,
        panelResize: null,
        
        // Sound & Physics Tracking
        _dragStartTime: 0,
        _dragStartClientX: 0,
        _dragStartClientY: 0,
        _dragMaxClientDist: 0,
        _dragWorldStartX: 0,
        _dragWorldStartY: 0,
        _dragMaxWorldTension: 0,
        _releaseVelBuf: [],
        
        // Observation Panel State
        obsSelectedSlimeId: null,
        obsActiveTab: 'log',
        obsOpen: false,
        obsLoupeMode: false,
        obsDrag: null,
        obsResize: null,
        obsPos: null,
        
        // Objects & Particles
        prairieObjects: [],
        activeBubbles: [],
    };
}