// AdOff — Google IMA SDK Stub
// Replaces imasdk.googleapis.com/js/sdkloader/ima3.js
// Implements the full IMA API surface but never serves ads.
// When the site calls adsManager.start(), we immediately fire the
// complete lifecycle: LOADED → STARTED → CONTENT_RESUME_REQUESTED
// so the video player resumes without showing any ad.
// Based on the open-source approach used by uBlock Origin, AdGuard, and Mozilla.
(function () {
  "use strict";
  if (window.google && window.google.ima && window.google.ima.AdsLoader) return;

  // --- Event system ---
  class EventHandler {
    constructor() { this._map = new Map(); }
    addEventListener(evts, fn) {
      for (const t of (Array.isArray(evts) ? evts : [evts])) {
        if (!this._map.has(t)) this._map.set(t, new Set());
        this._map.get(t).add(fn);
      }
    }
    removeEventListener(evts, fn) {
      for (const t of (Array.isArray(evts) ? evts : [evts])) {
        const s = this._map.get(t);
        if (s) s.delete(fn);
      }
    }
    _fire(evt) {
      const s = this._map.get(evt.type);
      if (!s) return;
      for (const fn of s) { try { fn(evt); } catch (_) {} }
    }
  }

  // --- Ad stubs ---
  class Ad {
    getAdId()              { return ""; }
    getAdSystem()          { return ""; }
    getAdvertiserName()    { return ""; }
    getApiFramework()      { return null; }
    getCompanionAds()      { return []; }
    getContentType()       { return ""; }
    getCreativeAdId()      { return ""; }
    getCreativeId()        { return ""; }
    getDealId()            { return ""; }
    getDescription()       { return ""; }
    getDuration()          { return 0.1; }
    getHeight()            { return 0; }
    getWidth()             { return 0; }
    getMediaUrl()          { return null; }
    getMinSuggestedDuration() { return 0; }
    getSkipTimeOffset()    { return -1; }
    getSurveyUrl()         { return null; }
    getTitle()             { return ""; }
    getTraffickingParameters()       { return {}; }
    getTraffickingParametersString() { return ""; }
    getUiElements()        { return []; }
    getUniversalAdIdRegistry() { return "unknown"; }
    getUniversalAdIdValue()    { return "unknown"; }
    getUniversalAdIds()    { return [{ adIdRegistry: "unknown", adIdValue: "unknown" }]; }
    getVastMediaBitrate()  { return 0; }
    getVastMediaHeight()   { return 0; }
    getVastMediaWidth()    { return 0; }
    getWrapperAdIds()      { return []; }
    getWrapperAdSystems()  { return []; }
    getWrapperCreativeIds(){ return []; }
    isLinear()             { return true; }
    isSkippable()          { return true; }
  }

  // --- Event types ---
  const AdEventType = {
    AD_BREAK_READY:           "adBreakReady",
    AD_BUFFERING:             "adBuffering",
    AD_CAN_PLAY:              "adCanPlay",
    AD_ERROR:                 "adError",
    AD_METADATA:              "adMetadata",
    AD_PROGRESS:              "adProgress",
    ALL_ADS_COMPLETED:        "allAdsCompleted",
    CLICK:                    "click",
    COMPLETE:                 "complete",
    CONTENT_PAUSE_REQUESTED:  "contentPauseRequested",
    CONTENT_RESUME_REQUESTED: "contentResumeRequested",
    DURATION_CHANGE:          "durationChange",
    FIRST_QUARTILE:           "firstQuartile",
    IMPRESSION:               "impression",
    INTERACTION:              "interaction",
    LINEAR_CHANGED:           "linearChanged",
    LOADED:                   "loaded",
    LOG:                      "log",
    MIDPOINT:                 "midpoint",
    PAUSED:                   "pause",
    RESUMED:                  "resume",
    SKIPPABLE_STATE_CHANGED:  "skippableStateChanged",
    SKIPPED:                  "skip",
    STARTED:                  "start",
    THIRD_QUARTILE:           "thirdQuartile",
    USER_CLOSE:               "userClose",
    VIDEO_CLICKED:            "videoClicked",
    VIDEO_ICON_CLICKED:       "videoIconClicked",
    VIEWABLE_IMPRESSION:      "viewableImpression",
    VOLUME_CHANGED:           "volumeChange",
    VOLUME_MUTED:             "mute",
  };

  class AdEvent {
    constructor(type) { this.type = type; }
    getAd()     { return new Ad(); }
    getAdData() { return {}; }
  }
  AdEvent.Type = AdEventType;

  // --- Error types ---
  const AdErrorType = {
    AD_LOAD: "adLoadError",
    AD_PLAY: "adPlayError",
  };
  const AdErrorCode = {
    UNKNOWN_ERROR:          900,
    VAST_EMPTY_RESPONSE:   1009,
    VAST_MALFORMED_RESPONSE: 100,
    ADS_REQUEST_NETWORK_ERROR: 1012,
  };

  class AdError {
    constructor(msg, code, type) {
      this._msg  = msg  || "";
      this._code = code || 1009;
      this._type = type || AdErrorType.AD_LOAD;
    }
    getErrorCode()  { return this._code; }
    getInnerError() { return null; }
    getMessage()    { return this._msg; }
    getType()       { return this._type; }
    getVastErrorCode() { return this._code; }
    toString()      { return "AdError " + this._code + ": " + this._msg; }
  }
  AdError.ErrorCode = AdErrorCode;
  AdError.Type = AdErrorType;

  class AdErrorEvent {
    constructor(error) {
      this.type  = AdEventType.AD_ERROR;
      this._err  = error || new AdError("No ads", 1009);
    }
    getError()              { return this._err; }
    getUserRequestContext() { return {}; }
  }
  AdErrorEvent.Type = { AD_ERROR: AdEventType.AD_ERROR };

  // --- AdsManager ---
  class AdsManager extends EventHandler {
    constructor() {
      super();
      this._vol = 1;
    }
    init() {}
    start() {
      // Fire full lifecycle immediately so player resumes
      requestAnimationFrame(() => {
        const seq = [
          AdEventType.LOADED,
          AdEventType.STARTED,
          AdEventType.CONTENT_PAUSE_REQUESTED,
          AdEventType.AD_BUFFERING,
          AdEventType.IMPRESSION,
          AdEventType.FIRST_QUARTILE,
          AdEventType.MIDPOINT,
          AdEventType.THIRD_QUARTILE,
          AdEventType.COMPLETE,
          AdEventType.ALL_ADS_COMPLETED,
          AdEventType.CONTENT_RESUME_REQUESTED,
        ];
        for (const t of seq) this._fire(new AdEvent(t));
      });
    }
    collapse()  {}
    configureAdsManager() {}
    destroy()   {}
    discardAdBreak() {}
    expand()    {}
    focus()     {}
    getAdSkippableState()  { return false; }
    getCuePoints()         { return []; }
    getCurrentAd()         { return new Ad(); }
    getRemainingTime()     { return 0; }
    getVolume()            { return this._vol; }
    isCustomClickTrackingUsed() { return false; }
    isCustomPlaybackUsed() { return false; }
    pause()     {}
    resize()    {}
    resume()    {}
    setVolume(v){ this._vol = v; }
    skip()      {}
    stop()      {}
    updateAdsRenderingSettings() {}
  }

  // --- AdsManagerLoadedEvent ---
  class AdsManagerLoadedEvent {
    constructor(mgr) {
      this.type = "adsManagerLoaded";
      this._mgr = mgr;
    }
    getAdsManager() { return this._mgr; }
    getUserRequestContext() { return {}; }
  }
  AdsManagerLoadedEvent.Type = { ADS_MANAGER_LOADED: "adsManagerLoaded" };

  // --- AdsLoader ---
  class AdsLoader extends EventHandler {
    constructor() { super(); }
    contentComplete() {}
    destroy()         {}
    getSettings()     { return new ImaSdkSettings(); }
    getVersion()      { return "3.746.0"; }
    requestAds(req, ctx) {
      requestAnimationFrame(() => {
        this._fire(new AdsManagerLoadedEvent(new AdsManager()));
      });
    }
  }

  // --- AdDisplayContainer ---
  class AdDisplayContainer {
    constructor(el) {
      if (el) {
        // Create a hidden div to satisfy sites that check for it
        const d = document.createElement("div");
        d.style.cssText = "display:none!important;visibility:collapse!important";
        try { el.appendChild(d); } catch (_) {}
      }
    }
    destroy()    {}
    initialize() {}
  }

  // --- Settings ---
  class ImaSdkSettings {
    getCompanionBackfill() { return ""; }
    getDisableCustomPlaybackForIOS10Plus() { return false; }
    getDisableFlashAds()   { return true; }
    getFeatureFlags()      { return {}; }
    getLocale()            { return "en"; }
    getNumRedirects()      { return 0; }
    getPlayerType()        { return "Unknown"; }
    getPlayerVersion()     { return "0.0.0"; }
    getPpid()              { return ""; }
    isCookiesEnabled()     { return true; }
    isVpaidAllowed()       { return true; }
    setAutoPlayAdBreaks()  {}
    setCompanionBackfill() {}
    setCookiesEnabled()    {}
    setDisableCustomPlaybackForIOS10Plus() {}
    setDisableFlashAds()   {}
    setFeatureFlags()      {}
    setLocale()            {}
    setNumRedirects()      {}
    setPlayerType()        {}
    setPlayerVersion()     {}
    setPpid()              {}
    setSessionId()         {}
    setStreamCorrelator()  {}
    setVpaidAllowed()      {}
    setVpaidMode()         {}
    getVersion()           { return "3.746.0"; }
  }

  // --- Other stubs ---
  class AdsRenderingSettings {
    constructor() {
      this.autoAlign = true;
      this.bitrate = -1;
      this.enablePreloading = false;
      this.loadVideoTimeout = 8000;
      this.mimeTypes = null;
      this.playAdsAfterTime = -1;
      this.restoreCustomPlaybackStateOnAdBreakComplete = false;
      this.uiElements = null;
      this.useStyledLinearAds = false;
      this.useStyledNonLinearAds = true;
    }
  }

  class AdsRequest {
    constructor() {
      this.adTagUrl = "";
      this.adsResponse = "";
      this.contentDuration = 0;
      this.contentKeywords = [];
      this.contentTitle = "";
      this.forceNonLinearFullSlot = false;
      this.linearAdSlotHeight = 0;
      this.linearAdSlotWidth = 0;
      this.liveStreamPrefetchSeconds = 0;
      this.nonLinearAdSlotHeight = 0;
      this.nonLinearAdSlotWidth = 0;
      this.vastLoadTimeout = 5000;
    }
    setAdWillAutoPlay()      {}
    setAdWillPlayMuted()     {}
    setContinuousPlayback()  {}
  }

  class CompanionAdSelectionSettings {}
  CompanionAdSelectionSettings.CreativeType = { ALL: "All", FLASH: "Flash", IMAGE: "Image" };
  CompanionAdSelectionSettings.ResourceType = { ALL: "All", HTML: "Html", IFRAME: "IFrame", STATIC: "Static" };
  CompanionAdSelectionSettings.SizeCriteria = { IGNORE: "IgnoreSize", SELECT_EXACT_MATCH: "SelectExactMatch", SELECT_NEAR_MATCH: "SelectNearMatch" };

  const CompanionBackfillMode = { ALWAYS: "always", ON_MASTER_AD: "on_master_ad" };

  const OmidAccessMode = { DOMAIN: "domain", FULL: "full", LIMITED: "limited" };

  const OmidVerificationVendor = {
    GOOGLE: 1, MOAT: 2, DOUBLEVERIFY: 3, INTEGRAL_AD_SCIENCE: 4,
    PIXELATE: 5, NIELSEN: 6, COMSCORE: 7, MEETRICS: 8, OTHER: 9,
  };

  const UiElements = { AD_ATTRIBUTION: "adAttribution", COUNTDOWN: "countdown" };

  const UniversalAdIdInfo = function (registry, value) {
    this.adIdRegistry = registry || "";
    this.adIdValue = value || "";
  };

  const ViewMode = { FULLSCREEN: "fullscreen", NORMAL: "normal" };

  const VERSION = "3.746.0";

  // --- DAI stub (Dynamic Ad Insertion) ---
  const dai = {
    api: {
      Ad: class DaiAd {
        constructor() { this.duration = 0; this.skipOffset = -1; }
        getDuration() { return 0; }
      },
      AdPodInfo: class {
        getAdPosition()     { return 1; }
        getIsBumper()       { return false; }
        getMaxDuration()    { return 0; }
        getPodIndex()       { return 1; }
        getTimeOffset()     { return 0; }
        getTotalAds()       { return 1; }
      },
      AdProgressData: function () {},
      CompanionAd: function () {},
      CuePoint: function () {},
      StreamData: function () {},
      StreamEvent: class {
        static Type = {
          AD_BREAK_ENDED:   "adBreakEnded",
          AD_BREAK_STARTED: "adBreakStarted",
          AD_PROGRESS:      "adProgress",
          ALL_ADS_COMPLETED:"allAdsCompleted",
          CLICK:            "click",
          COMPLETE:         "complete",
          CUEPOINTS_CHANGED:"cuepointsChanged",
          ERROR:            "error",
          FIRST_QUARTILE:   "firstQuartile",
          LOADED:           "loaded",
          MIDPOINT:         "midpoint",
          STARTED:          "started",
          STREAM_INITIALIZED: "streamInitialized",
          THIRD_QUARTILE:   "thirdQuartile",
        };
      },
      StreamManager: class extends EventHandler {
        constructor() { super(); }
        contentTimeForStreamTime(t) { return t; }
        getStreamId()       { return ""; }
        onTimedMetadata()   {}
        previousCuePointForStreamTime() { return null; }
        processMetadata()   {}
        requestStream()     {}
        reset()             {}
        streamTimeForContentTime(t) { return t; }
      },
      StreamRequest: class {
        constructor() {
          this.adTagParameters = null;
          this.apiKey = "";
          this.assetKey = "";
          this.authToken = "";
          this.contentSourceId = "";
          this.format = "";
          this.networkCode = "";
          this.streamActivityMonitorId = "";
          this.videoId = "";
        }
      },
      VODStreamRequest: class {
        constructor() {
          this.adTagParameters = null;
          this.apiKey = "";
          this.authToken = "";
          this.contentSourceId = "";
          this.networkCode = "";
          this.streamActivityMonitorId = "";
          this.videoId = "";
        }
      },
      LiveStreamRequest: class {
        constructor() {
          this.adTagParameters = null;
          this.apiKey = "";
          this.assetKey = "";
          this.authToken = "";
          this.networkCode = "";
          this.streamActivityMonitorId = "";
        }
      },
      PodStreamRequest: class {
        constructor() {
          this.adTagParameters = null;
          this.apiKey = "";
          this.customAssetKey = "";
          this.networkCode = "";
        }
      },
    },
  };

  // --- Assemble namespace ---
  window.google = window.google || {};
  window.google.ima = {
    Ad,
    AdDisplayContainer,
    AdError,
    AdErrorEvent,
    AdEvent,
    AdsLoader,
    AdsManager,
    AdsManagerLoadedEvent,
    AdsRenderingSettings,
    AdsRequest,
    CompanionAdSelectionSettings,
    CompanionBackfillMode,
    ImaSdkSettings,
    OmidAccessMode,
    OmidVerificationVendor,
    UiElements,
    UniversalAdIdInfo,
    VERSION,
    ViewMode,
    dai,
    settings: new ImaSdkSettings(),
  };
})();
