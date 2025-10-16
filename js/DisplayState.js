/**
 * DisplayState.js - Gestionnaire d'état centralisé
 * 
 * Remplace les variables globales:
 * - imgShow, imgLoad, player
 * Gère:
 * - État de la boucle (running, paused, stopped)
 * - Index courant du média
 * - Métadonnées des médias
 * - Cycle timing
 */

class DisplayState {
  constructor() {
    // État de la boucle
    this.loopState = 'stopped'; // stopped | running | paused
    this.currentIndex = 0;
    this.mediaList = [];
    
    // Élément affichant actuellement
    this.activePlayer = 1; // 1 ou 2 (double buffering)
    
    // Timing
    this.currentMediaEndTime = null;
    this.cycleStartTime = null;
    this.cycleDuration = 0;
    
    // Callbacks
    this.listeners = new Map();
    
    // Logger - support Node.js et browser
    if (typeof window !== 'undefined' && window?.logger) {
      this.logger = window.logger;
    } else {
      this.logger = console;
    }
  }

  /**
   * Initialiser avec liste de médias
   */
  setMediaList(mediaList) {
    this.mediaList = mediaList;
    this.currentIndex = 0;
    this.emit('mediaListUpdated', { count: mediaList.length });
    
    this.logger.debug('state', `Media list set: ${mediaList.length} items`);
  }

  /**
   * Démarrer la boucle
   */
  startLoop() {
    if (this.loopState !== 'stopped') {
      this.logger.warn('state', `Cannot start loop from state: ${this.loopState}`);
      return;
    }
    
    this.loopState = 'running';
    this.cycleStartTime = Date.now();
    this.currentIndex = 0;
    
    this.emit('loopStarted');
    this.logger.info('state', 'Loop started');
  }

  /**
   * Arrêter la boucle
   */
  stopLoop() {
    this.loopState = 'stopped';
    this.currentIndex = 0;
    
    this.emit('loopStopped');
    this.logger.info('state', 'Loop stopped');
  }

  /**
   * Pauser la boucle
   */
  pauseLoop() {
    if (this.loopState !== 'running') {
      this.logger.warn('state', `Cannot pause loop from state: ${this.loopState}`);
      return;
    }
    
    this.loopState = 'paused';
    this.emit('loopPaused');
    this.logger.info('state', 'Loop paused');
  }

  /**
   * Reprendre après pause
   */
  resumeLoop() {
    if (this.loopState !== 'paused') {
      this.logger.warn('state', `Cannot resume loop from state: ${this.loopState}`);
      return;
    }
    
    this.loopState = 'running';
    this.emit('loopResumed');
    this.logger.info('state', 'Loop resumed');
  }

  /**
   * Avancer au média suivant
   */
  nextMedia() {
    if (this.mediaList.length === 0) return;
    
    this.currentIndex = (this.currentIndex + 1) % this.mediaList.length;
    this.currentMediaEndTime = null;
    
    this.emit('mediaChanged', {
      index: this.currentIndex,
      media: this.getCurrentMedia(),
      isCycleComplete: this.currentIndex === 0,
    });
    
    this.logger.debug('state', `Next media: index=${this.currentIndex}`);
  }

  /**
   * Aller au média précédent
   */
  previousMedia() {
    if (this.mediaList.length === 0) return;
    
    this.currentIndex = (this.currentIndex - 1 + this.mediaList.length) % this.mediaList.length;
    this.currentMediaEndTime = null;
    
    this.emit('mediaChanged', {
      index: this.currentIndex,
      media: this.getCurrentMedia(),
    });
    
    this.logger.debug('state', `Previous media: index=${this.currentIndex}`);
  }

  /**
   * Aller à un index spécifique
   */
  goToIndex(index) {
    if (index < 0 || index >= this.mediaList.length) {
      this.logger.warn('state', `Index out of bounds: ${index}`);
      return;
    }
    
    this.currentIndex = index;
    this.currentMediaEndTime = null;
    
    this.emit('mediaChanged', {
      index: this.currentIndex,
      media: this.getCurrentMedia(),
    });
    
    this.logger.debug('state', `Go to index: ${index}`);
  }

  /**
   * Obtenir le média courant
   */
  getCurrentMedia() {
    return this.mediaList[this.currentIndex];
  }

  /**
   * Obtenir le média suivant (pour preload)
   */
  getNextMedia() {
    if (this.mediaList.length === 0) return null;
    const nextIndex = (this.currentIndex + 1) % this.mediaList.length;
    return this.mediaList[nextIndex];
  }

  /**
   * Alterner le player (double buffering)
   */
  togglePlayer() {
    this.activePlayer = this.activePlayer === 1 ? 2 : 1;
    this.emit('playerToggled', { activePlayer: this.activePlayer });
    
    this.logger.debug('state', `Player toggled: ${this.activePlayer}`);
  }

  /**
   * Récupérer le player inactif (pour preload)
   */
  getInactivePlayer() {
    return this.activePlayer === 1 ? 2 : 1;
  }

  /**
   * Définir temps de fin du média courant
   */
  setMediaEndTime(endTime) {
    this.currentMediaEndTime = endTime;
    this.emit('mediaEndTimeSet', { endTime });
    
    this.logger.debug('state', `Media end time: ${(endTime / 1000).toFixed(1)}s`);
  }

  /**
   * S'abonner aux changements d'état
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    return () => {
      const callbacks = this.listeners.get(event);
      callbacks.splice(callbacks.indexOf(callback), 1);
    };
  }

  /**
   * Se désabonner d'un événement
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    callbacks.splice(callbacks.indexOf(callback), 1);
  }

  /**
   * Émettre un événement
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error('state', `Listener error on ${event}`, error);
      }
    }
  }

  /**
   * Obtenir snapshot d'état
   */
  getSnapshot() {
    return {
      loopState: this.loopState,
      currentIndex: this.currentIndex,
      mediaCount: this.mediaList.length,
      activePlayer: this.activePlayer,
      currentMedia: this.getCurrentMedia(),
      nextMedia: this.getNextMedia(),
      currentMediaEndTime: this.currentMediaEndTime,
    };
  }

  /**
   * Restaurer depuis snapshot
   */
  restoreSnapshot(snapshot) {
    this.loopState = snapshot.loopState || 'stopped';
    this.currentIndex = snapshot.currentIndex || 0;
    this.activePlayer = snapshot.activePlayer || 1;
    this.currentMediaEndTime = snapshot.currentMediaEndTime || null;
    
    this.emit('snapshotRestored', snapshot);
    this.logger.info('state', 'State restored from snapshot');
  }

  /**
   * Réinitialiser l'état
   */
  reset() {
    this.loopState = 'stopped';
    this.currentIndex = 0;
    this.activePlayer = 1;
    this.currentMediaEndTime = null;
    this.mediaList = [];
    
    this.emit('reset');
    this.logger.info('state', 'State reset');
  }
}

// Export
if (typeof window !== 'undefined') {
  window.DisplayState = DisplayState;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DisplayState };
}
