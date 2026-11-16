/* eslint-disable @typescript-eslint/no-unused-vars */
/* Облегчённая версия таймеров: ES5-синтаксис и только старые DOM/Web API. */
(function () {
  "use strict";

  var TIMERS_KEY = "timers:list:v1";
  var SOUND_KEY = "timers:sound-mode:v1";
  var MIN_MINUTES = 1;
  var MAX_MINUTES = 180;
  var ALARM_REPEAT_MS = 2600;
  var MAX_MELODY_SIZE = 20 * 1024 * 1024;
  var PRESETS = [1, 5, 10, 25, 45];

  var timers = [];
  var soundMode = "default";
  var melodyUrl = null;
  var melodyName = null;

  var chimeCtx = null;
  var chimeLoop = null;
  var customAudio = null;
  var alarmActive = false;

  var listEl;
  var emptyEl;
  var countEl;
  var clearDoneEl;
  var minutesInput;
  var nameInput;
  var soundErrorEl;

  function byId(id) {
    return document.getElementById(id);
  }

  function now() {
    return new Date().getTime();
  }

  function pad(value) {
    return value < 10 ? "0" + value : "" + value;
  }

  function formatDuration(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;

    return hours > 0 ? hours + ":" + pad(minutes) + ":" + pad(seconds) : pad(minutes) + ":" + pad(seconds);
  }

  function formatMinutes(ms) {
    var minutes = ms / 60000;
    if (minutes % 1 !== 0) return minutes.toFixed(1).replace(".", ",") + " мин";
    return minutes + " мин";
  }

  function formatEnd(timestamp) {
    if (!timestamp) return "";
    var date = new Date(timestamp);
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function clampMinutes(value) {
    value = parseInt(value, 10);
    if (isNaN(value)) value = MIN_MINUTES;
    if (value < MIN_MINUTES) value = MIN_MINUTES;
    if (value > MAX_MINUTES) value = MAX_MINUTES;
    return value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function remainingOf(timer) {
    if (timer.status === "running" && timer.endsAt) {
      return Math.max(0, timer.endsAt - now());
    }
    return Math.max(0, timer.remainingMs || 0);
  }

  function findTimer(id) {
    for (var i = 0; i < timers.length; i++) {
      if (timers[i].id === id) return timers[i];
    }
    return null;
  }

  /* ---------- сохранение ---------- */

  function saveTimers() {
    try {
      localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
    } catch (error) {
      /* ignore */
    }
  }

  function loadTimers() {
    var raw;
    try {
      raw = localStorage.getItem(TIMERS_KEY);
    } catch (error) {
      return [];
    }
    if (!raw) return [];

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return [];
    }
    if (!parsed || !parsed.length) return [];

    var result = [];
    for (var i = 0; i < parsed.length; i++) {
      var timer = parsed[i];
      if (!timer || typeof timer.id !== "string" || typeof timer.durationMs !== "number") continue;
      if (!timer.name) timer.name = "Таймер";
      if (!timer.remainingMs) timer.remainingMs = 0;

      if (timer.status === "finished") {
        timer.status = "finished";
        timer.endsAt = null;
        timer.remainingMs = 0;
        timer.alarm = false;
      } else if (timer.status === "running") {
        if (!timer.endsAt) {
          timer.status = "paused";
          timer.endsAt = null;
        } else if (timer.endsAt <= now()) {
          timer.status = "finished";
          timer.endsAt = null;
          timer.remainingMs = 0;
          timer.alarm = false;
        }
      } else {
        timer.status = "paused";
        timer.endsAt = null;
      }

      result.push(timer);
    }
    return result;
  }

  /* ---------- звук ---------- */

  function getCtx() {
    if (chimeCtx) return chimeCtx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      chimeCtx = new Ctor();
    } catch (error) {
      return null;
    }
    return chimeCtx;
  }

  function resumeCtx() {
    var ctx = getCtx();
    if (ctx && ctx.state === "suspended" && ctx.resume) {
      try {
        ctx.resume();
      } catch (error) {
        /* ignore */
      }
    }
    return ctx;
  }

  function playTone(ctx, frequency, start, duration, peak) {
    try {
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    } catch (error) {
      /* ignore */
    }
  }

  function playChime() {
    var ctx = resumeCtx();
    if (!ctx) return;
    var start = ctx.currentTime + 0.03;
    playTone(ctx, 440, start, 0.6, 0.14);
    playTone(ctx, 880, start + 0.02, 0.6, 0.18);
    playTone(ctx, 1174.66, start + 0.2, 0.6, 0.18);
    playTone(ctx, 1567.98, start + 0.38, 0.6, 0.18);
  }

  function stopChimeLoop() {
    if (chimeLoop) {
      clearInterval(chimeLoop);
      chimeLoop = null;
    }
  }

  function stopCustomAudio() {
    if (customAudio) {
      try {
        customAudio.pause();
        customAudio.src = "";
      } catch (error) {
        /* ignore */
      }
      customAudio = null;
    }
  }

  function stopAlarm() {
    alarmActive = false;
    stopChimeLoop();
    stopCustomAudio();
  }

  function startChimeLoop() {
    stopChimeLoop();
    playChime();
    chimeLoop = setInterval(function () {
      if (!alarmActive) {
        stopChimeLoop();
        return;
      }
      playChime();
    }, ALARM_REPEAT_MS);
  }

  function startAlarm() {
    if (alarmActive) return;
    alarmActive = true;

    if (soundMode === "custom" && melodyUrl) {
      try {
        customAudio = new Audio(melodyUrl);
        customAudio.loop = true;
        var promise = customAudio.play();
        if (promise && promise.catch) {
          promise.catch(function () {
            customAudio = null;
            if (alarmActive) startChimeLoop();
          });
        }
        return;
      } catch (error) {
        customAudio = null;
      }
    }

    startChimeLoop();
  }

  function hasActiveAlarm() {
    for (var i = 0; i < timers.length; i++) {
      if (timers[i].status === "finished" && timers[i].alarm) return true;
    }
    return false;
  }

  function syncAlarm() {
    if (hasActiveAlarm()) {
      startAlarm();
    } else {
      stopAlarm();
    }
  }

  function applySoundChange() {
    if (alarmActive) stopAlarm();
    syncAlarm();
  }

  function previewSound() {
    resumeCtx();
    if (soundMode === "custom" && melodyUrl) {
      try {
        var audio = new Audio(melodyUrl);
        audio.play();
        setTimeout(function () {
          try {
            audio.pause();
            audio.src = "";
          } catch (error) {
            /* ignore */
          }
        }, 6000);
      } catch (error) {
        playChime();
      }
      return;
    }
    playChime();
  }

  /* ---------- мелодия в IndexedDB ---------- */

  function openDb(callback) {
    if (!window.indexedDB) {
      callback(null);
      return;
    }
    var request;
    try {
      request = window.indexedDB.open("timers-db", 1);
    } catch (error) {
      callback(null);
      return;
    }
    request.onupgradeneeded = function () {
      var database = request.result;
      if (!database.objectStoreNames.contains("melody")) {
        database.createObjectStore("melody", { keyPath: "id" });
      }
    };
    request.onsuccess = function () {
      callback(request.result);
    };
    request.onerror = function () {
      callback(null);
    };
  }

  function saveMelody(file, done) {
    openDb(function (database) {
      if (!database) {
        done({ name: file.name, blob: file });
        return;
      }
      try {
        var tx = database.transaction("melody", "readwrite");
        tx.objectStore("melody").put({ id: "custom", name: file.name, blob: file, savedAt: now() });
        tx.oncomplete = function () {
          database.close();
          done({ name: file.name, blob: file });
        };
        tx.onerror = function () {
          database.close();
          showSoundError("Не удалось сохранить мелодию в браузере.");
        };
      } catch (error) {
        database.close();
        showSoundError("Не удалось сохранить мелодию в браузере.");
      }
    });
  }

  function loadMelody(done) {
    openDb(function (database) {
      if (!database) {
        done(null);
        return;
      }
      try {
        var tx = database.transaction("melody", "readonly");
        var request = tx.objectStore("melody").get("custom");
        request.onsuccess = function () {
          database.close();
          done(request.result || null);
        };
        request.onerror = function () {
          database.close();
          done(null);
        };
      } catch (error) {
        database.close();
        done(null);
      }
    });
  }

  function deleteMelody(done) {
    openDb(function (database) {
      if (!database) {
        done();
        return;
      }
      try {
        var tx = database.transaction("melody", "readwrite");
        tx.objectStore("melody").delete("custom");
        tx.oncomplete = function () {
          database.close();
          done();
        };
        tx.onerror = function () {
          database.close();
          done();
        };
      } catch (error) {
        database.close();
        done();
      }
    });
  }

  /* ---------- интерфейс ---------- */

  function button(action, id, label, variant) {
    var className = "btn" + (variant ? " btn-" + variant : "");
    return (
      '<button type="button" class="' +
      className +
      '" data-action="' +
      action +
      '" data-id="' +
      id +
      '">' +
      label +
      "</button>"
    );
  }

  function cardHtml(timer) {
    var id = escapeHtml(timer.id);
    var running = timer.status === "running";
    var paused = timer.status === "paused";
    var finished = timer.status === "finished";
    var remaining = remainingOf(timer);
    var percent = timer.durationMs > 0 ? Math.min(100, Math.max(0, (remaining * 100) / timer.durationMs)) : 0;

    var actions = "";
    if (finished) {
      if (timer.alarm) actions += button("silence", id, "Стоп", "danger");
      actions += button("reset", id, "Повторить", "primary");
    } else {
      actions += running
        ? button("pause", id, "Пауза", "primary")
        : button("resume", id, "Продолжить", "primary");
      actions += button("add-minute", id, "+1 мин", "");
      actions +=
        '<button type="button" class="btn btn-icon" data-action="reset" data-id="' +
        id +
        '" title="Сбросить" aria-label="Сбросить">&#8635;</button>';
    }

    var meta;
    if (running) {
      meta = '<span class="dot"></span>Идёт &middot; до ' + formatEnd(timer.endsAt);
    } else if (paused) {
      meta = "На паузе";
    } else {
      meta = "Время вышло";
    }

    return (
      '<article class="timer timer-' +
      timer.status +
      '" data-id="' +
      id +
      '">' +
      '<div class="timer-head">' +
      '<h3 class="timer-name" title="' +
      escapeHtml(timer.name) +
      '">' +
      escapeHtml(timer.name) +
      "</h3>" +
      '<button type="button" class="btn btn-icon" data-action="delete" data-id="' +
      id +
      '" title="Удалить" aria-label="Удалить">&#10005;</button>' +
      "</div>" +
      '<div class="timer-meta">' +
      meta +
      "</div>" +
      '<div class="timer-time js-time">' +
      formatDuration(remaining) +
      "</div>" +
      '<div class="timer-total">из ' +
      formatMinutes(timer.durationMs) +
      "</div>" +
      '<div class="progress"><div class="progress-bar js-bar" style="width:' +
      percent +
      '%"></div></div>' +
      '<div class="actions">' +
      actions +
      "</div>" +
      "</article>"
    );
  }

  function updateClocks() {
    if (!listEl) return;
    var cards = listEl.getElementsByTagName("article");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var timer = findTimer(card.getAttribute("data-id"));
      if (!timer) continue;

      var remaining = remainingOf(timer);
      var timeEl = card.getElementsByClassName("js-time")[0];
      if (timeEl) timeEl.textContent = formatDuration(remaining);

      var barEl = card.getElementsByClassName("js-bar")[0];
      if (barEl) {
        var percent =
          timer.durationMs > 0 ? Math.min(100, Math.max(0, (remaining * 100) / timer.durationMs)) : 0;
        barEl.style.width = percent + "%";
      }
    }
  }

  function renderList() {
    var i;
    if (!timers.length) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      var parts = [];
      for (i = 0; i < timers.length; i++) parts.push(cardHtml(timers[i]));
      listEl.innerHTML = parts.join("");
    }

    if (timers.length) {
      countEl.textContent = String(timers.length);
      countEl.hidden = false;
    } else {
      countEl.hidden = true;
    }

    var silentFinished = 0;
    for (i = 0; i < timers.length; i++) {
      if (timers[i].status === "finished" && !timers[i].alarm) silentFinished++;
    }
    clearDoneEl.hidden = silentFinished === 0;

    updateClocks();
    updateTitle();
  }

  function updateTitle() {
    var alarming = false;
    var nextTimer = null;

    for (var i = 0; i < timers.length; i++) {
      var timer = timers[i];
      if (timer.status === "finished" && timer.alarm) alarming = true;
      if (timer.status === "running" && timer.endsAt && (!nextTimer || timer.endsAt < nextTimer.endsAt)) {
        nextTimer = timer;
      }
    }

    if (alarming) {
      document.title = "🔔 Время вышло — Таймеры";
    } else if (nextTimer) {
      document.title = formatDuration(nextTimer.endsAt - now()) + " · " + nextTimer.name;
    } else {
      document.title = "Таймеры — облегчённая версия";
    }
  }

  function updateSoundUi() {
    var defaultBtn = byId("mode-default");
    var customBtn = byId("mode-custom");
    var melodyRow = byId("melody-row");
    var uploadLabel = byId("upload-label");

    defaultBtn.className = "seg" + (soundMode === "default" ? " active" : "");
    customBtn.className = "seg" + (soundMode === "custom" ? " active" : "");
    customBtn.disabled = !melodyUrl;

    if (melodyName) {
      byId("melody-name").textContent = melodyName;
      melodyRow.hidden = false;
      uploadLabel.textContent = "Заменить мелодию";
    } else {
      melodyRow.hidden = true;
      uploadLabel.textContent = "Загрузить мелодию";
    }
  }

  function showSoundError(message) {
    soundErrorEl.textContent = message;
    soundErrorEl.hidden = false;
  }

  function clearSoundError() {
    soundErrorEl.textContent = "";
    soundErrorEl.hidden = true;
  }

  function updatePresets() {
    var minutes = clampMinutes(minutesInput.value);
    var buttons = byId("presets").getElementsByTagName("button");
    for (var i = 0; i < buttons.length; i++) {
      var value = parseInt(buttons[i].getAttribute("data-minutes"), 10);
      buttons[i].className = "preset" + (value === minutes ? " active" : "");
    }
  }

  /* ---------- действия ---------- */

  function addTimer(name, minutes) {
    var timestamp = now();
    var durationMs = clampMinutes(minutes) * 60000;
    var timer = {
      id: "t" + timestamp + Math.floor(Math.random() * 100000),
      name: name || "Таймер " + (timers.length + 1),
      durationMs: durationMs,
      remainingMs: durationMs,
      endsAt: timestamp + durationMs,
      status: "running",
      alarm: false,
      createdAt: timestamp,
    };

    timers.unshift(timer);
    saveTimers();
    renderList();
    resumeCtx();
  }

  function handleAction(action, id) {
    var timer = findTimer(id);
    if (!timer) return;

    var timestamp = now();
    var boost = 60000;
    var i;

    if (action === "delete") {
      for (i = 0; i < timers.length; i++) {
        if (timers[i].id === id) {
          timers.splice(i, 1);
          break;
        }
      }
    } else if (action === "pause" && timer.status === "running") {
      timer.remainingMs = Math.max(0, (timer.endsAt || timestamp) - timestamp);
      timer.endsAt = null;
      timer.status = "paused";
    } else if (action === "resume" && timer.status === "paused") {
      timer.endsAt = timestamp + timer.remainingMs;
      timer.status = "running";
    } else if (action === "reset") {
      timer.status = "running";
      timer.remainingMs = timer.durationMs;
      timer.endsAt = timestamp + timer.durationMs;
      timer.alarm = false;
    } else if (action === "add-minute") {
      if (timer.status === "running" && timer.endsAt) {
        timer.durationMs += boost;
        timer.endsAt += boost;
      } else if (timer.status === "paused") {
        timer.durationMs += boost;
        timer.remainingMs += boost;
      }
    } else if (action === "silence") {
      timer.alarm = false;
    }

    saveTimers();
    renderList();
    syncAlarm();
  }

  function tick() {
    var current = now();
    var finishedAny = false;

    for (var i = 0; i < timers.length; i++) {
      var timer = timers[i];
      if (timer.status === "running" && timer.endsAt && timer.endsAt <= current) {
        timer.status = "finished";
        timer.endsAt = null;
        timer.remainingMs = 0;
        timer.alarm = true;
        finishedAny = true;
      }
    }

    if (finishedAny) {
      saveTimers();
      renderList();
      syncAlarm();
    }

    updateClocks();
    updateTitle();
  }

  /* ---------- события ---------- */

  function bindEvents() {
    byId("add-form").onsubmit = function (event) {
      if (event.preventDefault) event.preventDefault();
      var minutes = clampMinutes(minutesInput.value);
      addTimer((nameInput.value || "").replace(/^\s+|\s+$/g, ""), minutes);
      nameInput.value = "";
      minutesInput.value = String(minutes);
      updatePresets();
      nameInput.focus();
      return false;
    };

    byId("minus").onclick = function () {
      minutesInput.value = String(clampMinutes(minutesInput.value) - 1);
      updatePresets();
    };

    byId("plus").onclick = function () {
      minutesInput.value = String(clampMinutes(minutesInput.value) + 1);
      updatePresets();
    };

    minutesInput.oninput = function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 3);
      updatePresets();
    };

    minutesInput.onblur = function () {
      this.value = String(clampMinutes(this.value));
      updatePresets();
    };

    minutesInput.onfocus = function () {
      this.select();
    };

    var presetsEl = byId("presets");
    for (var i = 0; i < PRESETS.length; i++) {
      var presetButton = document.createElement("button");
      presetButton.type = "button";
      presetButton.className = "preset";
      presetButton.setAttribute("data-minutes", String(PRESETS[i]));
      presetButton.appendChild(document.createTextNode(PRESETS[i] + " мин"));
      presetButton.onclick = function () {
        minutesInput.value = this.getAttribute("data-minutes");
        updatePresets();
      };
      presetsEl.appendChild(presetButton);
    }
    updatePresets();

    listEl.onclick = function (event) {
      var target = event.target;
      while (target && target !== listEl) {
        if (target.getAttribute && target.getAttribute("data-action")) break;
        target = target.parentNode;
      }
      if (!target || target === listEl) return;
      handleAction(target.getAttribute("data-action"), target.getAttribute("data-id"));
    };

    clearDoneEl.onclick = function () {
      var kept = [];
      for (var index = 0; index < timers.length; index++) {
        if (timers[index].status !== "finished" || timers[index].alarm) kept.push(timers[index]);
      }
      timers = kept;
      saveTimers();
      renderList();
      syncAlarm();
    };

    byId("mode-default").onclick = function () {
      soundMode = "default";
      try {
        localStorage.setItem(SOUND_KEY, soundMode);
      } catch (error) {
        /* ignore */
      }
      updateSoundUi();
      applySoundChange();
    };

    byId("mode-custom").onclick = function () {
      if (!melodyUrl) return;
      soundMode = "custom";
      try {
        localStorage.setItem(SOUND_KEY, soundMode);
      } catch (error) {
        /* ignore */
      }
      updateSoundUi();
      applySoundChange();
    };

    byId("preview").onclick = function () {
      previewSound();
    };

    byId("file").onchange = function (event) {
      var input = event.target;
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;

      clearSoundError();
      var isAudio = file.type && file.type.indexOf("audio/") === 0;
      var byExtension = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i.test(file.name);
      if (!isAudio && !byExtension) {
        showSoundError("Это не аудиофайл. Подойдёт MP3, WAV, OGG или M4A.");
        return;
      }
      if (file.size > MAX_MELODY_SIZE) {
        showSoundError("Файл больше 20 МБ.");
        return;
      }

      saveMelody(file, function (record) {
        if (!record) return;
        if (melodyUrl) {
          try {
            URL.revokeObjectURL(melodyUrl);
          } catch (error) {
            /* ignore */
          }
        }
        melodyUrl = URL.createObjectURL(record.blob);
        melodyName = record.name || "Мелодия";
        soundMode = "custom";
        try {
          localStorage.setItem(SOUND_KEY, soundMode);
        } catch (error) {
          /* ignore */
        }
        updateSoundUi();
        resumeCtx();
        applySoundChange();
      });
    };

    byId("melody-remove").onclick = function () {
      deleteMelody(function () {
        if (melodyUrl) {
          try {
            URL.revokeObjectURL(melodyUrl);
          } catch (error) {
            /* ignore */
          }
        }
        melodyUrl = null;
        melodyName = null;
        soundMode = "default";
        try {
          localStorage.setItem(SOUND_KEY, soundMode);
        } catch (error) {
          /* ignore */
        }
        updateSoundUi();
        applySoundChange();
      });
    };

    document.onvisibilitychange = function () {
      if (document.visibilityState === "visible") tick();
    };

    var unlock = function () {
      resumeCtx();
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
    document.addEventListener("click", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }

  function init() {
    listEl = byId("list");
    emptyEl = byId("empty");
    countEl = byId("count");
    clearDoneEl = byId("clear-done");
    minutesInput = byId("minutes");
    nameInput = byId("timer-name");
    soundErrorEl = byId("sound-error");

    timers = loadTimers();

    try {
      var storedMode = localStorage.getItem(SOUND_KEY);
      if (storedMode === "custom" || storedMode === "default") soundMode = storedMode;
    } catch (error) {
      /* ignore */
    }

    bindEvents();
    renderList();
    updateSoundUi();

    loadMelody(function (record) {
      if (!record || !record.blob) return;
      try {
        melodyUrl = URL.createObjectURL(record.blob);
        melodyName = record.name || "Мелодия";
        updateSoundUi();
      } catch (error) {
        /* ignore */
      }
    });

    setInterval(tick, 200);
    tick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
