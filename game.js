/*
 * Errands of Iris - by Jerome Lecomte (herebefrogs), js13kGames 2026.
 * Built on Game Jam Boilerplate (c) 2017 Jerome Lecomte, MIT License (see LICENSE).
 * Includes ZzFX by Frank Force (MIT) and the SoundBox player by Marcus Geelnard (zlib/libpng).
 * Adapted for PewPlay (responsive layout, touch, audio unlock); readable esbuild bundle of the original ES modules.
 */
(() => {
  // src/js/inputs/keyboard.js
  var KEYS = {};
  var _isKeyDown = (code) => KEYS[code] || 0;
  var _releaseKey = (code) => delete KEYS[code];
  addEventListener("keydown", (e) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !/^F\d/.test(e.code)) e.preventDefault();
    if (!e.repeat) {
      KEYS[e.code] = performance.now();
    }
  });
  addEventListener("keyup", (e) => _releaseKey(e.code));
  addEventListener("blur", () => {
    for (const code in KEYS) delete KEYS[code];
  });
  var isKeyDown = (...codes) => Math.max(...codes.map((code) => _isKeyDown(code)));
  var whichKeyDown = () => Object.keys(KEYS).filter((code) => _isKeyDown(code));
  var anyKeyDown = () => whichKeyDown().length;
  var isKeyUp = (code) => _isKeyDown(code) ? _releaseKey(code) : false;

  // src/js/utils.js
  var clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  function lerp(min, max, t) {
    if (t < 0) return min;
    if (t > 1) return max;
    return min * (1 - t) + max * t;
  }
  function loadImg(dataUri) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        resolve(img);
      };
      img.src = dataUri;
    });
  }

  // src/js/inputs/pointer.js
  var x = 0;
  var y = 0;
  var vX = 0;
  var vY = 0;
  var aX = 0;
  var aY = 0;
  var RAMP = 55;
  var DEAD = 8;
  var pointerDownTime = 0;
  var lastEvent;
  var activeId;
  var pressTime = 0;
  var PRESS_LATCH = 250;
  var pressPending = () => pressTime && performance.now() - pressTime < PRESS_LATCH;
  addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    lastEvent = e;
    activeId = e.pointerId;
    pointerDownTime = pressTime = performance.now();
    [x, y] = [aX, aY] = pointerLocation();
    vX = vY = 0;
  });
  addEventListener("pointermove", (e) => {
    e.preventDefault();
    if (pointerDownTime && e.pointerId !== activeId) return;
    lastEvent = e;
    [x, y] = pointerLocation();
    if (pointerDownTime) {
      updatePad();
    }
  });
  var release = (e) => {
    if (e.pointerId !== activeId) return;
    lastEvent = e;
    activeId = void 0;
    pointerDownTime = 0;
    vX = vY = aX = aY = 0;
  };
  addEventListener("pointerup", (e) => {
    e.preventDefault();
    release(e);
  });
  addEventListener("pointercancel", release);
  addEventListener("contextmenu", (e) => e.preventDefault());
  var pointerLocation = () => [Math.floor(lastEvent.clientX), Math.floor(lastEvent.clientY)];
  function updatePad() {
    aX = clamp(aX, x - RAMP, x + RAMP);
    aY = clamp(aY, y - RAMP, y + RAMP);
    vX = deflect(x - aX);
    vY = deflect(y - aY);
  }
  function deflect(d) {
    const m = Math.abs(d);
    return m <= DEAD ? 0 : Math.sign(d) * clamp((m - DEAD) / (RAMP - DEAD), 0, 1);
  }
  var isPointerDown = () => pointerDownTime || pressPending();
  var isPointerUp = () => isPointerDown() ? (pointerDownTime = pressTime = 0) || true : false;
  var pointerCanvasPosition = (canvas) => {
    if (!lastEvent) return [-1, -1];
    const r = canvas.getBoundingClientRect();
    return [
      (lastEvent.clientX - r.left) / r.width,
      (lastEvent.clientY - r.top) / r.height
    ];
  };
  var pointerDirection = () => [vX, vY];
  var pointerPad = () => [aX, aY, x, y, RAMP, DEAD];

  // src/js/player.js
  var CPlayer = function() {
    var osc_sin = function(value) {
      return Math.sin(value * 6.283184);
    };
    var osc_saw = function(value) {
      return 2 * (value % 1) - 1;
    };
    var osc_square = function(value) {
      return value % 1 < 0.5 ? 1 : -1;
    };
    var osc_tri = function(value) {
      var v2 = value % 1 * 4;
      if (v2 < 2) return v2 - 1;
      return 3 - v2;
    };
    var getnotefreq = function(n) {
      return 0.003959503758 * 2 ** ((n - 128) / 12);
    };
    var createNote = function(instr, n, rowLen) {
      var osc1 = mOscillators[instr.i[0]], o1vol = instr.i[1], o1xenv = instr.i[3] / 32, osc2 = mOscillators[instr.i[4]], o2vol = instr.i[5], o2xenv = instr.i[8] / 32, noiseVol = instr.i[9], attack = instr.i[10] * instr.i[10] * 4, sustain = instr.i[11] * instr.i[11] * 4, release2 = instr.i[12] * instr.i[12] * 4, releaseInv = 1 / release2, expDecay = -instr.i[13] / 16, arp = instr.i[14], arpInterval = rowLen * 2 ** (2 - instr.i[15]);
      var noteBuf = new Int32Array(attack + sustain + release2);
      var c1 = 0, c2 = 0;
      var j, j2, e, t, rsample, o1t, o2t;
      for (j = 0, j2 = 0; j < attack + sustain + release2; j++, j2++) {
        if (j2 >= 0) {
          arp = arp >> 8 | (arp & 255) << 4;
          j2 -= arpInterval;
          o1t = getnotefreq(n + (arp & 15) + instr.i[2] - 128);
          o2t = getnotefreq(n + (arp & 15) + instr.i[6] - 128) * (1 + 8e-4 * instr.i[7]);
        }
        e = 1;
        if (j < attack) {
          e = j / attack;
        } else if (j >= attack + sustain) {
          e = (j - attack - sustain) * releaseInv;
          e = (1 - e) * 3 ** (expDecay * e);
        }
        c1 += o1t * e ** o1xenv;
        rsample = osc1(c1) * o1vol;
        c2 += o2t * e ** o2xenv;
        rsample += osc2(c2) * o2vol;
        if (noiseVol) {
          rsample += (2 * Math.random() - 1) * noiseVol;
        }
        noteBuf[j] = 80 * rsample * e | 0;
      }
      return noteBuf;
    };
    var mOscillators = [
      osc_sin,
      osc_square,
      osc_saw,
      osc_tri
    ];
    var mSong, mLastRow, mCurrentCol, mNumWords, mMixBuf;
    this.init = function(song) {
      mSong = song;
      mLastRow = song.endPattern;
      mCurrentCol = 0;
      mNumWords = song.rowLen * song.patternLen * (mLastRow + 1) * 2;
      mMixBuf = new Int32Array(mNumWords);
    };
    this.generate = function() {
      var i, j, b, p, row, col, n, cp, k, t, lfor, e, x2, rsample, rowStartSample, f, da;
      var chnBuf = new Int32Array(mNumWords), instr = mSong.songData[mCurrentCol], rowLen = mSong.rowLen, patternLen = mSong.patternLen;
      var low = 0, band = 0, high;
      var lsample, filterActive = false;
      var noteCache = [];
      for (p = 0; p <= mLastRow; ++p) {
        cp = instr.p[p];
        for (row = 0; row < patternLen; ++row) {
          var cmdNo = cp ? instr.c[cp - 1].f[row] : 0;
          if (cmdNo) {
            instr.i[cmdNo - 1] = instr.c[cp - 1].f[row + patternLen] || 0;
            if (cmdNo < 17) {
              noteCache = [];
            }
          }
          var oscLFO = mOscillators[instr.i[16]], lfoAmt = instr.i[17] / 512, lfoFreq = 2 ** (instr.i[18] - 9) / rowLen, fxLFO = instr.i[19], fxFilter = instr.i[20], fxFreq = instr.i[21] * 43.23529 * 3.141592 / 44100, q = 1 - instr.i[22] / 255, dist = instr.i[23] * 1e-5, drive = instr.i[24] / 32, panAmt = instr.i[25] / 512, panFreq = 6.283184 * 2 ** (instr.i[26] - 9) / rowLen, dlyAmt = instr.i[27] / 255, dly = instr.i[28] * rowLen & ~1;
          rowStartSample = (p * patternLen + row) * rowLen;
          for (col = 0; col < 4; ++col) {
            n = cp ? instr.c[cp - 1].n[row + col * patternLen] : 0;
            if (n) {
              if (!noteCache[n]) {
                noteCache[n] = createNote(instr, n, rowLen);
              }
              var noteBuf = noteCache[n];
              for (j = 0, i = rowStartSample * 2; j < noteBuf.length; j++, i += 2) {
                chnBuf[i] += noteBuf[j];
              }
            }
          }
          for (j = 0; j < rowLen; j++) {
            k = (rowStartSample + j) * 2;
            rsample = chnBuf[k];
            if (rsample || filterActive) {
              f = fxFreq;
              if (fxLFO) {
                f *= oscLFO(lfoFreq * k) * lfoAmt + 0.5;
              }
              f = 1.5 * Math.sin(f);
              low += f * band;
              high = q * (rsample - band) - low;
              band += f * high;
              rsample = fxFilter == 3 ? band : fxFilter == 1 ? high : low;
              if (dist) {
                rsample *= dist;
                rsample = rsample < 1 ? rsample > -1 ? osc_sin(rsample * 0.25) : -1 : 1;
                rsample /= dist;
              }
              rsample *= drive;
              filterActive = rsample * rsample > 1e-5;
              t = Math.sin(panFreq * k) * panAmt + 0.5;
              lsample = rsample * (1 - t);
              rsample *= t;
            } else {
              lsample = 0;
            }
            if (k >= dly) {
              lsample += chnBuf[k - dly + 1] * dlyAmt;
              rsample += chnBuf[k - dly] * dlyAmt;
            }
            chnBuf[k] = lsample | 0;
            chnBuf[k + 1] = rsample | 0;
            mMixBuf[k] += lsample | 0;
            mMixBuf[k + 1] += rsample | 0;
          }
        }
      }
      mCurrentCol++;
      return mCurrentCol / mSong.numChannels;
    };
    this.createAudioBuffer = function(context) {
      var buffer = context.createBuffer(2, mNumWords / 2, 44100);
      for (var i = 0; i < 2; i++) {
        var data = buffer.getChannelData(i);
        for (var j = i; j < mNumWords; j += 2) {
          data[j >> 1] = mMixBuf[j] / 65536;
        }
      }
      return buffer;
    };
  };

  // src/js/sound.js
  var zzfxX;
  var MASTER_VOLUME = 0.3;
  var zzfxMaster;
  var masterLevel = MASTER_VOLUME;
  var initAudio = () => {
    if (zzfxX) return true;
    try {
      zzfxX = new (window.AudioContext || window.webkitAudioContext)();
      zzfxMaster = zzfxX.createGain();
      zzfxMaster.gain.value = masterLevel;
      zzfxMaster.connect(zzfxX.destination);
      return true;
    } catch (e) {
      zzfxX = void 0;
      return false;
    }
  };
  var setVolume = (v) => {
    masterLevel = v;
    if (zzfxMaster) zzfxMaster.gain.value = v;
  };
  var zzfxV = 0.3;
  var zzfxR = 44100;
  var zzfxP = (...t) => {
    if (!zzfxX) return { playbackRate: { value: 1 } };
    let e = zzfxX.createBufferSource(), f = zzfxX.createBuffer(t.length, t[0].length, zzfxR);
    t.map((d, i) => f.getChannelData(i).set(d)), e.buffer = f, e.connect(zzfxMaster), e.start();
    return e;
  };
  var zzfxG = (p = 1, k = 0.05, b = 220, e = 0, r = 0, t = 0.1, q = 0, D = 1, u = 0, y2 = 0, v = 0, z = 0, l = 0, E = 0, A = 0, F = 0, c2 = 0, w = 1, m = 0, B = 0, N = 0, M = Math, d = 2 * M.PI, R = zzfxR, G = u *= 500 * d / R / R, C = b *= (1 - k + 2 * k * M.random(k = [])) * d / R, g = 0, H = 0, a = 0, n = 1, I = 0, J = 0, f = 0, h = N < 0 ? -1 : 1, x2 = d * h * N * 2 / R, L = M.cos(x2), Z = M.sin, K = Z(x2) / 4, O = 1 + K, X = -2 * L / O, Y = (1 - K) / O, P = (1 + h * L) / 2 / O, Q = -(h + L) / O, S = P, T = 0, U = 0, V = 0, W = 0) => {
    e = R * e + 9;
    m *= R;
    r *= R;
    t *= R;
    c2 *= R;
    y2 *= 500 * d / R ** 3;
    A *= d / R;
    v *= d / R;
    z *= R;
    l = R * l | 0;
    p *= zzfxV;
    for (h = e + m + r + t + c2 | 0; a < h; k[a++] = f * p) ++J % (100 * F | 0) || (f = q ? 1 < q ? 2 < q ? 3 < q ? 4 < q ? (g / d % 1 < D / 2) * 2 - 1 : Z(g ** 3) : M.max(M.min(M.tan(g), 1), -1) : 1 - (2 * g / d % 2 + 2) % 2 : 1 - 4 * M.abs(M.round(g / d) - g / d) : Z(g), f = (l ? 1 - B + B * Z(d * a / l) : 1) * (4 < q ? f : (f < 0 ? -1 : 1) * M.abs(f) ** D) * (a < e ? a / e : a < e + m ? 1 - (a - e) / m * (1 - w) : a < e + m + r ? w : a < h - c2 ? (h - a - c2) / t * w : 0), f = c2 ? f / 2 + (c2 > a ? 0 : (a < h - c2 ? 1 : (h - a) / c2) * k[a - c2 | 0] / 2 / p) : f, N ? f = W = S * T + Q * (T = U) + P * (U = f) - Y * V - X * (V = W) : 0), x2 = (b += u += y2) * M.cos(A * H++), g += x2 + x2 * E * Z(a ** 5), n && ++n > z && (b += v, C += v, n = 0), !l || ++I % l || (b = C, u = G, n = n || 1);
    return k;
  };
  var zzfx = (...t) => zzfxP(zzfxG(...t));
  var playSound = (soundData) => zzfx(...soundData);
  var SFX_DIG = [1, 0.05, 178, 0.04, 0.03, 0.08, 1, 2.5, 2, 171, 0, 0, 0, 0.8, 0, 0.1, 0, 0.59, 0.05, 0, -1488];
  var SFX_TALLY = [1.8, 0.05, 523, 0.02, 0.09, 0.29, 0, 0.7, 0, 0, 307, 0.1, 0, 0.2, 0, 0.1, 0, 0.69, 0.01, 0, -1497];
  var SFX_RAINBOW = [1, 0.02, 90, 0.05, 1.2, 1, 0, 1, 0.35, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.3];
  var SFX_RAINBOW_DURATION = 2.55;
  var musicSrc;
  var renderSong = (data) => {
    const p = new CPlayer();
    p.init(data);
    while (p.generate() < 1) {
    }
    return p;
  };
  var songBuffer = (player) => zzfxX ? player.createAudioBuffer(zzfxX) : void 0;
  var playMusic = (buffer) => {
    stopMusic();
    if (!zzfxX || !buffer) return;
    musicSrc = zzfxX.createBufferSource();
    musicSrc.buffer = buffer;
    musicSrc.loop = true;
    musicSrc.connect(zzfxMaster);
    musicSrc.start();
  };
  var stopMusic = () => {
    if (musicSrc) {
      try {
        musicSrc.stop();
      } catch (e) {
      }
      musicSrc = null;
    }
  };
  var resumeAudio = () => {
    try {
      if (zzfxX) zzfxX.resume();
    } catch (e) {
    }
  };
  var suspendAudio = () => {
    try {
      if (zzfxX) zzfxX.suspend();
    } catch (e) {
    }
  };

  // src/js/song-game.js
  var song_game_default = { songData: [{ i: [0, 193, 116, 64, 0, 193, 120, 0, 64, 96, 4, 6, 35, 0, 0, 0, 0, 0, 0, 0, 2, 14, 0, 10, 32, 0, 0, 0, 0], p: [1, 1, 1, 1], c: [{ n: [135, , 135, , , , , , , , 135, , , , , , 135, , 135, , , , , , , , 135], f: [] }] }, { i: [3, 0, 128, 0, 3, 57, 128, 0, 64, 183, 4, 4, 53, 68, 0, 0, 1, 55, 4, 1, 2, 67, 115, 124, 190, 67, 6, 39, 1], p: [1, 1, 1, 1], c: [{ n: [, , , , 147, , , 147, , , , , 147, , , , , , , , 147, , , 147, , , , , 147], f: [] }] }, { i: [2, 10, 140, 64, 0, 0, 140, 0, 0, 64, 5, 0, 67, 104, 0, 0, 0, 0, 0, 0, 3, 161, 192, 0, 32, 0, 0, 52, 1], p: [1, 1, 1, 1], c: [{ n: [147, , 147, 147, 147, , 147, , 147, , 147, 147, 147, , 147, , 147, , 147, 147, 147, , 147, , 147, , 147, 147, 147, , 147], f: [] }] }, { i: [3, 73, 128, 0, 2, 75, 128, 6, 0, 0, 12, 12, 33, 0, 0, 0, 0, 61, 4, 1, 2, 109, 86, 7, 32, 112, 3, 67, 2], p: [1, 2, 3, 4], c: [{ n: [124, , 124, , , , , , , , 121, , , , , , 120, , 132, , , , , , , , 114], f: [] }, { n: [115, , 122, , , , , , , , 123, , , , , , 122, , 129, , , , , , , , 129], f: [] }, { n: [124, , 131, , , , , , , , 136, , , , , , 120, , 120, , , , , , , , 127], f: [] }, { n: [115, , 115, , , , , , , , 123, , , , , , 122, , 122, , , , , , , , 123], f: [] }] }, { i: [3, 27, 128, 0, 2, 27, 128, 6, 0, 0, 12, 12, 33, 0, 0, 0, 0, 61, 4, 1, 2, 109, 86, 7, 32, 112, 3, 67, 2], p: [1, 2, 3, 4], c: [{ n: [, , , , , , , , , , , , , , , , , , , , , , 148, , , , , , , , 148, , , , , , , , , , , , , , , , , , , , , , , , 151, , , , , , , , 151, , , , , , , , , , , , , , , , , , , , , , , , 156, , , , , , , , 156], f: [] }, { n: [, , , , , , 146, , , , , , , , 146, , , , , , , , , , , , , , , , , , , , , , , , 151, , , , , , , , 151, , , , , , , , , , , , , , , , , , , , , , , , 155, , , , , , , , 155], f: [] }, { n: [, , , , , , 148, , , , , , , , 148, , , , , , , , , , , , , , , , , , , , , , , , 151, , , , , , , , 151, , , , , , , , , , , , , , , , , , , , , , , , 155, , , , , , , , 155], f: [] }, { n: [, , , , , , 146, , , , , , , , 146, , , , , , , , 146, , , , , , , , , , , , , , , , 151, , , , , , , , 151, , , , , , , , 150, , , , , , , , , , , , , , , , 155, , , , , , , , 155, , , , , , , , 153], f: [] }] }, { i: [1, 57, 128, 0, 1, 57, 128, 9, 0, 0, 5, 28, 30, 0, 0, 0, 0, 195, 6, 1, 2, 135, 0, 0, 18, 147, 6, 49, 3], p: [1, 2, 3, 4], c: [{ n: [155, , , , , , 151, , 148, , 148, , , , , , 156, , , , 150, , 151, , 144], f: [] }, { n: [158, , , , 153, , 155, , 151, , , , , , , , 150, , , , 150, , 151], f: [] }, { n: [155, , , , 150, , 151, , 148, , 148, , , , , , 156, , , , 150, , 151, , 144, , 148], f: [] }, { n: [155, , , , 150, , 151, , 146, , 148, , 150, , , , 150, , , , 150, , 151], f: [] }] }], rowLen: 4531, patternLen: 32, endPattern: 3, numChannels: 6 };

  // src/js/storage.js
  var PREFIX = "errands-of-iris:";
  var save = (key, value) => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
    }
  };
  var load = (key) => {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + key));
    } catch (e) {
      return null;
    }
  };

  // src/js/text.js
  var ALIGN_LEFT = 0;
  var ALIGN_CENTER = 1;
  var ALIGN = ["left", "center", "right"];
  var CHARSET_SIZE = 8;
  var FONT = "Impact, Roboto, -apple-system, sans-serif";
  var FILL = 1;
  var textCanvas;
  var ctx;
  var capH = 0.7;
  var calibrate = () => {
    ctx.font = `100px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    const m = ctx.measureText("HAMBURGX0369");
    capH = m.actualBoundingBoxAscent / 100;
  };
  var textRes = 1;
  var initTextBuffer = (canvas, w, h, res = 1) => {
    textRes = res;
    textCanvas = canvas.cloneNode();
    textCanvas.width = Math.max(1, Math.round(w * res));
    textCanvas.height = Math.max(1, Math.round(h * res));
    ctx = textCanvas.getContext("2d");
    calibrate();
    ctx.setTransform(res, 0, 0, res, 0, 0);
    return textCanvas;
  };
  var clearTextBuffer = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.setTransform(textRes, 0, 0, textRes, 0, 0);
  };
  function renderText(msg, x2, y2, align = ALIGN_LEFT, scale = 1, color = "#fff") {
    const box = scale * CHARSET_SIZE * FILL;
    msg = "" + msg;
    ctx.font = `${box / capH}px ${FONT}`;
    ctx.textAlign = ALIGN[align];
    ctx.textBaseline = "alphabetic";
    if (color === "#fff") {
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.lineWidth = box / 3;
      ctx.strokeStyle = "#000";
      ctx.strokeText(msg, x2, y2 + box);
    }
    ctx.fillStyle = color;
    ctx.fillText(msg, x2, y2 + box);
  }
  function textWidth(msg, scale = 1) {
    ctx.font = `${scale * CHARSET_SIZE * FILL / capH}px ${FONT}`;
    return ctx.measureText("" + msg).width;
  }
  var BUBBLE_TAIL_W = 16;
  var BUBBLE_TAIL_H = 10;
  function renderBubble(x2, y2, w, h, r, tail = "down") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(x2, y2, w, h, r);
    if (tail === "right") {
      const cy = y2 + h - r - BUBBLE_TAIL_W / 2;
      ctx.moveTo(x2 + w, cy - BUBBLE_TAIL_W / 2);
      ctx.lineTo(x2 + w, cy + BUBBLE_TAIL_W / 2);
      ctx.lineTo(x2 + w + BUBBLE_TAIL_H, cy + BUBBLE_TAIL_W / 2);
    } else {
      const cx = x2 + w / 2;
      ctx.moveTo(cx - BUBBLE_TAIL_W / 2, y2 + h);
      ctx.lineTo(cx + BUBBLE_TAIL_W / 2, y2 + h);
      ctx.lineTo(cx, y2 + h + BUBBLE_TAIL_H);
    }
    ctx.closePath();
    ctx.fill();
  }

  // src/js/terrain.js
  var CELL_SIZE = 8;
  var SAND = 0;
  var CLAY = 1;
  var MATERIAL_COLOR = ["#e0c088", "#96633c"];
  var MATERIAL_DRAG = [90, 300];
  var terrainSeed = 0;
  var dustSeed = 0;
  var setMapSeed = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    let s = (h += h << 5) >>> 0;
    const next = () => (s = Math.imul(48271, s)) >>> 0;
    next();
    terrainSeed = next();
    dustSeed = next();
  };
  var hash2D = (x2, y2, seed = terrainSeed) => {
    let h = Math.imul(x2 ^ seed, 374761393) ^ Math.imul(y2 + seed, 668265263);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };
  var dustHash = (x2, y2) => hash2D(x2, y2, dustSeed);
  var FILLED = 3;
  var PATTERN_WEIGHTS = [0.15, 0.5, 0.35, 0];
  var SECTION_SIZE = 480;
  var sectionPattern = (sx, sy) => {
    const roll = hash2D(sx + 99991, sy + 99991);
    let acc = 0;
    for (let p = 0; p < PATTERN_WEIGHTS.length; p++) {
      acc += PATTERN_WEIGHTS[p];
      if (roll < acc) return p;
    }
    return PATTERN_WEIGHTS.length - 1;
  };
  var PATTERN_ROCK = [
    null,
    // CLEAR
    { minR: 18, maxR: 32, chance: 0.5 },
    // SPARSE
    { minR: 70, maxR: 115, chance: 0.35 },
    // DENSE
    null
    // FILLED
  ];
  var ROCK_CELL = 170;
  var blobAt = (gx, gy) => {
    const sx = Math.floor(gx * ROCK_CELL / SECTION_SIZE);
    const sy = Math.floor(gy * ROCK_CELL / SECTION_SIZE);
    const cfg = PATTERN_ROCK[sectionPattern(sx, sy)];
    if (!cfg || hash2D(gx + 31337, gy + 31337) >= cfg.chance) return null;
    return {
      x: (gx + hash2D(gx, gy)) * ROCK_CELL,
      y: (gy + hash2D(gx, gy + 1)) * ROCK_CELL,
      r: cfg.minR + hash2D(gx + 1, gy) * (cfg.maxR - cfg.minR),
      amp1: 0.15 + hash2D(gx + 2, gy) * 0.15,
      phase1: hash2D(gx, gy + 2) * 6.28,
      amp2: 0.05 + hash2D(gx + 3, gy) * 0.1,
      phase2: hash2D(gx, gy + 3) * 6.28
    };
  };
  var blobDepth = (x2, y2) => {
    const gx = Math.floor(x2 / ROCK_CELL), gy = Math.floor(y2 / ROCK_CELL);
    let best = 0;
    for (let ny = gy - 1; ny <= gy + 1; ny++) {
      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        const b = blobAt(nx, ny);
        if (!b) continue;
        const dx = x2 - b.x, dy = y2 - b.y;
        const angle = Math.atan2(dy, dx);
        const wobble = 1 + b.amp1 * Math.sin(3 * angle + b.phase1) + b.amp2 * Math.sin(7 * angle + b.phase2);
        const depth2 = 1 - Math.hypot(dx, dy) / (b.r * wobble);
        if (depth2 > best) best = depth2;
      }
    }
    return best;
  };
  var sampleMaterial = (x2, y2) => {
    const pattern = sectionPattern(Math.floor(x2 / SECTION_SIZE), Math.floor(y2 / SECTION_SIZE));
    if (pattern === FILLED) return CLAY;
    return blobDepth(x2, y2) > 0 ? CLAY : SAND;
  };
  var materialColor = (type) => MATERIAL_COLOR[type];
  var DUST_NONE = 0;
  var DUST_SPARSE = 1;
  var DUST_DENSE = 2;
  var DUST_WEIGHTS = [0.66, 0.25, 0.09];
  var DUST_CELL = 132;
  var DUST_PATCH = [
    null,
    // NONE
    { minR: 38, maxR: 76 },
    // SPARSE
    { minR: 22, maxR: 46 }
    // DENSE
  ];
  var dustPatchAt = (gx, gy) => {
    const roll = dustHash(gx + 54812, gy + 54812);
    let acc = 0, cat = 0;
    for (; cat < DUST_WEIGHTS.length - 1; cat++) {
      acc += DUST_WEIGHTS[cat];
      if (roll < acc) break;
    }
    const cfg = DUST_PATCH[cat];
    if (!cfg) return null;
    return {
      cat,
      x: (gx + dustHash(gx + 7, gy + 7)) * DUST_CELL,
      y: (gy + dustHash(gx + 7, gy + 11)) * DUST_CELL,
      r: cfg.minR + dustHash(gx + 13, gy + 7) * (cfg.maxR - cfg.minR),
      amp1: 0.2 + dustHash(gx + 17, gy + 7) * 0.2,
      phase1: dustHash(gx + 7, gy + 17) * 6.28,
      amp2: 0.08 + dustHash(gx + 23, gy + 7) * 0.12,
      phase2: dustHash(gx + 7, gy + 23) * 6.28
    };
  };
  var dustContains = (p, x2, y2) => {
    const dx = x2 - p.x, dy = y2 - p.y;
    const angle = Math.atan2(dy, dx);
    const wobble = 1 + p.amp1 * Math.sin(3 * angle + p.phase1) + p.amp2 * Math.sin(5 * angle + p.phase2);
    return Math.hypot(dx, dy) <= p.r * wobble;
  };
  var dustDitherLit = (x2, y2) => {
    const cx = Math.floor(x2 / CELL_SIZE), cy = Math.floor(y2 / CELL_SIZE);
    return (cx & 1) === 0 && (cy & 1) === 0;
  };
  var sampleDust = (x2, y2) => {
    const gx = Math.floor(x2 / DUST_CELL), gy = Math.floor(y2 / DUST_CELL);
    let found = DUST_NONE;
    for (let ny = gy - 1; ny <= gy + 1; ny++) {
      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        const p = dustPatchAt(nx, ny);
        if (!p || !dustContains(p, x2, y2)) continue;
        if (p.cat === DUST_DENSE) return DUST_DENSE;
        if (dustDitherLit(x2, y2)) found = DUST_SPARSE;
      }
    }
    return found;
  };

  // src/img/tileset.webp
  var tileset_default = "./img/tileset.webp";

  // src/img/sprites.webp
  var sprites_default = "./img/sprites.webp";

  // src/js/game.js
  var isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  var TITLE_SCREEN = 0;
  var GAME_SCREEN = 1;
  var REWIND_SCREEN = 2;
  var END_SCREEN = 3;
  var HIGHSCORE_SCREEN = 4;
  var screen = TITLE_SCREEN;
  var NORMALIZE_DIAGONAL = Math.cos(Math.PI / 4);
  var HERO_W = 28;
  var HERO_H = 28;
  var TAIL_WIGGLE_RATE = 0.35;
  var BODY_LAG_STIFFNESS = 18;
  var BODY_LAG_DAMPING = 0.6;
  var BODY_LAG_LOOKAHEAD = 0.15;
  var BODY_LAG_MAX = 30 * Math.PI / 180;
  var JUMP_BEND = 45 * Math.PI / 180;
  var TURN_SPEED = 4 * Math.PI;
  var MOMENTUM = {
    initial: 600,
    // launch impulse
    max: 600,
    // soft cap: the highest momentum ordinary drilling holds you at, and where an overspeed boost decays back to (see overBleed). HUD "full speed".
    overMax: 800,
    // hard cap on the transient overshoot a dense patch can stack up (~1.33x max) - the kick is felt even when you enter a patch already at `max`. (digShaft sweeps the drill disc along the frame's path now, so a fast step no longer risks a tunnel gap - but keep this sane.)
    overBleed: 12,
    // 1/sec: exponential rate the excess ABOVE `max` decays (on top of normal drag). ~0.08s time constant, so a boost surges then settles back to `max` in ~0.25s instead of becoming a new plateau. This is the "extra drag above the cap" that makes the two caps mean different things.
    entropy: 35,
    // material-independent decay, always applied underground
    tunnelDrag: 15,
    // through an already-carved cell - cheap backtrack, not free
    airDrag: 0,
    // above the surface
    denseBoost: 30,
    // px/sec added per dense-dust cell dug; digShaft clears several cells/tick so patch entry is a jolt (see DESIGN Open questions)
    winMinDepth: 6 * CELL_SIZE
    // must have drilled at least this deep for a resurface to count as a win
  };
  var hero;
  var heroWentDeep;
  var outcome;
  var endArmed;
  var endIndex = 0;
  var depth;
  var tunnel;
  var dust;
  var dustPop;
  var particles;
  var score;
  var rainbowX;
  var rainbowX2;
  var rainbowT;
  var trail;
  var prevDrill;
  var rewound;
  var rewindI;
  var rewindT;
  var rewindSpeed;
  var rewindSkip;
  var rewindArmed;
  var rewindFillI;
  var musicGame;
  var musicBuffer;
  var musicUnlocked;
  var volumePct = MASTER_VOLUME * 100;
  function updateMusic() {
    if (!musicUnlocked) return;
    const want = screen === GAME_SCREEN || screen === REWIND_SCREEN || screen === END_SCREEN ? musicGame : void 0;
    if (want && want !== musicBuffer) {
      playMusic(want);
      musicBuffer = want;
    } else if (!want && musicBuffer) {
      stopMusic();
      musicBuffer = void 0;
    }
  }
  var VOLUME_STEP = 10;
  var VOLUME_MAX = 50;
  function cycleVolume() {
    volumePct = volumePct >= VOLUME_MAX ? 0 : volumePct + VOLUME_STEP;
    setVolume(volumePct / 100);
  }
  var cameraX = 0;
  var cameraY = 0;
  var cameraVX = 0;
  var cameraVY = 0;
  var cameraFocusX = 0;
  var cameraFocusY = 0;
  var CAMERA_DEADZONE = 100;
  var CAMERA_STIFFNESS = 15;
  var CAMERA_DAMPING = 1;
  var CAMERA_LOOKAHEAD = 0.133;
  var CAMERA_LOOKAHEAD_LAG = 0.22;
  var DEBUG_CAMERA = false;
  var DEBUG_POINTER = false;
  var RENDER_SCALE = 1;
  var MOBILE_REF_DPR = 2.625;
  var VIEW_FIT_W = 440;
  var VIEW_FIT_H = 440;
  var VIEW_MIN = 256;
  var VIEW_MAX = 2048;
  var CAMERA_WIDTH = 1280;
  var CAMERA_HEIGHT = 960;
  var SURFACE_Y = 360;
  var SKY_COLOR = "#9fd8ff";
  var TUNNEL_COLOR = "#000";
  var mapOffset = 0;
  var mapOffsetX = 0;
  var DUG = /* @__PURE__ */ new Set();
  var FILLED2 = /* @__PURE__ */ new Set();
  var cellKey = (wx, wy) => Math.floor(wx / CELL_SIZE) * CELL_SIZE + "_" + Math.floor(wy / CELL_SIZE) * CELL_SIZE;
  hero = {
    x: CAMERA_WIDTH - HERO_W / 2,
    // buffer centre (buffer is 2x CAMERA_WIDTH); reanchorBuffer() re-seats it on the first resize
    y: SURFACE_Y - HERO_H,
    // feet on the ground, not center
    w: HERO_W,
    h: HERO_H,
    angle: Math.PI / 2,
    // 0 = facing right (+x), PI/2 = facing down (+y)
    velX: 0,
    velY: 0,
    momentum: MOMENTUM.initial,
    tailPhase: 0,
    // render-only: advanced by distance travelled in moveHero(), drives the tail wiggle
    prevAngle: Math.PI / 2,
    // render-only: last frame's angle, so moveHero() can measure turn rate
    bodyLagAngle: 0,
    // render-only: body+tail's damped-spring rotation offset off the head, see moveHero
    bodyLagVel: 0
    // render-only: angular velocity of bodyLagAngle's spring
  };
  heroWentDeep = false;
  depth = 0;
  tunnel = 0;
  dust = 0;
  dustPop = -1;
  particles = [];
  trail = [hero.x + hero.w / 2 + mapOffsetX, hero.y + hero.h / 2 - SURFACE_Y + mapOffset];
  prevDrill = trail.slice();
  var CTX = c.getContext("2d");
  var BUFFER = c.cloneNode();
  var BUFFER_CTX = BUFFER.getContext("2d");
  BUFFER.width = 2 * CAMERA_WIDTH;
  BUFFER.height = 2 * CAMERA_HEIGHT;
  var MAP = c.cloneNode();
  var MAP_CTX = MAP.getContext("2d");
  MAP.width = 2 * CAMERA_WIDTH;
  MAP.height = 2 * CAMERA_HEIGHT;
  var DUST_MASK = c.cloneNode();
  var DUST_MASK_CTX = DUST_MASK.getContext("2d");
  DUST_MASK.width = 2 * CAMERA_WIDTH;
  DUST_MASK.height = 2 * CAMERA_HEIGHT;
  var DUST_LAYER = c.cloneNode();
  var DUST_LAYER_CTX = DUST_LAYER.getContext("2d");
  DUST_LAYER.width = CAMERA_WIDTH;
  DUST_LAYER.height = CAMERA_HEIGHT;
  var DUST_BAND = 40;
  var DUST_SPEED = 56;
  var DUST_PALETTE = [
    "#e0403a",
    // red
    "#d97b32",
    // orange
    "#be9a38",
    // yellow
    "#55913f",
    // green
    "#3f77b8",
    // blue
    "#4b52a8",
    // indigo
    "#8450b4"
    // violet
  ];
  var DUST_P = DUST_BAND * DUST_PALETTE.length;
  var DUST_GRADIENT = c.cloneNode();
  DUST_GRADIENT.width = DUST_GRADIENT.height = DUST_P;
  {
    const g = DUST_GRADIENT.getContext("2d");
    const L = DUST_PALETTE.length;
    const sw = DUST_BAND / Math.SQRT2;
    const span = DUST_P * 2;
    g.translate(DUST_P / 2, DUST_P / 2);
    g.rotate(Math.PI / 4);
    for (let i = -Math.ceil(span / sw); i <= Math.ceil(span / sw); i++) {
      g.fillStyle = DUST_PALETTE[(i % L + L) % L];
      g.fillRect(Math.floor(i * sw), -span, Math.ceil(sw) + 1, 2 * span);
    }
  }
  var DUST_PATTERN = DUST_LAYER_CTX.createPattern(DUST_GRADIENT, "repeat");
  var PARTICLE_SIZE = CELL_SIZE;
  var PARTICLE_PUSH_MARGIN = CELL_SIZE * 3;
  var PARTICLE_GROW_DURATION = 0.25;
  var PARTICLE_FLY_DURATION = 0.6;
  var PARTICLE_DURATION_JITTER = 0.2;
  var PX_PER_M = 32;
  var SCORE_PER_DUST = 10;
  var SCORE_PER_M = 2;
  function computeScore(dust2, shaft) {
    return SCORE_PER_DUST * dust2 + SCORE_PER_M * shaft;
  }
  var TRAIL_STEP = 4 * CELL_SIZE;
  var REWIND_DURATION = 1.1;
  var RAINBOW_GROW = 1.4;
  var RAINBOW_BANDS = DUST_PALETTE.length;
  var RAINBOW_DUST_HALF = 400;
  var RAINBOW_R_MIN = 140;
  var RAINBOW_R_MAX = 2e3;
  var RAINBOW_FOOT_MIN = 70;
  var RAINBOW_FOOT_MAX = 640;
  var RAINBOW_DOUBLE_MIN = 0.25;
  var RAINBOW_DOUBLE_MAX = 0.85;
  var RAINBOW_DOUBLE_OVERSHOOT = 0.15;
  var TEXT = initTextBuffer(c, CAMERA_WIDTH, CAMERA_HEIGHT);
  var HUD_SCALE = 3;
  var HUD_LINE = HUD_SCALE * CHARSET_SIZE + 4;
  var HUD_X = CHARSET_SIZE;
  var SPEED_VALUE_X = HUD_X + Math.max(textWidth("Speed: ", HUD_SCALE), textWidth("Dust: ", HUD_SCALE));
  var DUST_COUNTER_X = SPEED_VALUE_X;
  var DUST_COUNTER_Y = CHARSET_SIZE + 2 * HUD_LINE;
  var DUST_POP_DURATION = 0.18;
  var SPEED_VALUE_Y = CHARSET_SIZE;
  function renderHud() {
    renderText("Speed:", HUD_X, SPEED_VALUE_Y, ALIGN_LEFT, HUD_SCALE);
    {
      const str = Math.round(hero.momentum / PX_PER_M) + "m/s";
      const s = HUD_SCALE * (1 + clamp((hero.momentum - MOMENTUM.max) / (MOMENTUM.overMax - MOMENTUM.max), 0, 1));
      const cx = SPEED_VALUE_X + textWidth(str, HUD_SCALE) / 2;
      renderText(str, cx, SPEED_VALUE_Y - (s - HUD_SCALE) * CHARSET_SIZE / 2, ALIGN_CENTER, s);
    }
    renderText("Shaft:    " + Math.round(tunnel / PX_PER_M) + "m", HUD_X, CHARSET_SIZE + HUD_LINE, ALIGN_LEFT, HUD_SCALE);
    renderText("Dust:", HUD_X, DUST_COUNTER_Y, ALIGN_LEFT, HUD_SCALE);
    {
      const str = dust + "g";
      const s = HUD_SCALE * (1 + Math.sin(clamp((gameTime - dustPop) / DUST_POP_DURATION, 0, 1) * Math.PI));
      const cx = DUST_COUNTER_X + textWidth(str, HUD_SCALE) / 2;
      renderText(str, cx, DUST_COUNTER_Y - (s - HUD_SCALE) * CHARSET_SIZE / 2, ALIGN_CENTER, s);
    }
  }
  var tileset;
  var sprites;
  var currentTime;
  var elapsedTime;
  var lastTime;
  var requestId;
  var gameTime = 0;
  var running = true;
  var SPAWN_STEP = 32;
  function pickSpawnX() {
    for (let x2 = 0; x2 < SPAWN_STEP * 64; x2 += SPAWN_STEP) {
      let clear = true;
      for (let sx = x2 - HERO_W / 2; sx < x2 + HERO_W / 2; sx += CELL_SIZE)
        for (let sy = 0; sy < HERO_H * 4; sy += CELL_SIZE)
          if (sampleMaterial(sx + CELL_SIZE / 2, sy + CELL_SIZE / 2) === CLAY) clear = false;
      if (clear) return x2;
    }
    return 0;
  }
  function seatSpawn() {
    cameraX = cameraY = 0;
    mapOffset = 0;
    mapOffsetX = pickSpawnX() - CAMERA_WIDTH;
    hero.x = CAMERA_WIDTH - HERO_W / 2;
    hero.y = SURFACE_Y - HERO_H;
    hero.velX = hero.velY = 0;
    followCamera();
  }
  function newHero() {
    return {
      x: CAMERA_WIDTH - HERO_W / 2,
      // buffer centre (buffer is 2x CAMERA_WIDTH)
      y: SURFACE_Y - HERO_H,
      // feet on the ground, not center
      w: HERO_W,
      h: HERO_H,
      angle: Math.PI / 2,
      // 0 = facing right (+x), PI/2 = facing down (+y)
      velX: 0,
      velY: 0,
      momentum: MOMENTUM.initial,
      tailPhase: 0,
      prevAngle: Math.PI / 2,
      bodyLagAngle: 0,
      bodyLagVel: 0
    };
  }
  function startGame() {
    DUG.clear();
    FILLED2.clear();
    hero = newHero();
    seatSpawn();
    irisWalkT = irisRideT = irisArc = void 0;
    irisGroundOffset = 0;
    seatIris(titleBubbleLayout().irisX);
    heroWentDeep = false;
    outcome = void 0;
    depth = 0;
    tunnel = 0;
    dust = 0;
    dustPop = -1;
    particles = [];
    trail = [hero.x + hero.w / 2 + mapOffsetX, hero.y + hero.h / 2 - SURFACE_Y + mapOffset];
    prevDrill = trail.slice();
    renderMap();
    screen = GAME_SCREEN;
  }
  var pointerViewportPosition = () => {
    const [x2, y2] = pointerCanvasPosition(c);
    return [x2 * CAMERA_WIDTH, y2 * CAMERA_HEIGHT];
  };
  var titleIndex = 0;
  var titleArmed = false;
  function titleMenuItems() {
    return [
      { label: "Start", action: beginTitleJump },
      // sizeLabel: a stand-in for layout math - the live label's width changes
      // as volumePct's digit count does (0% vs 10%+), which would otherwise
      // jiggle the whole centred block every step; '50%' covers the widest
      // case (VOLUME_MAX) so the reserved width never moves. Fine if the live
      // label sits a touch narrower than that - it's left-aligned, not centred.
      // M still cycles it directly (see processInputs) - undocumented in the
      // label, same as P for pause; Up/Down+Enter/Space already makes menu
      // navigation obvious enough without also flagging every shortcut.
      { label: "Volume: " + volumePct + "%", sizeLabel: "Volume: 50%", action: cycleVolume },
      { label: "High scores", action: goHighscores },
      { label: "New seed", action: rerollSeed }
    ];
  }
  function randomSeed(len = 8) {
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return s;
  }
  function rerollSeed() {
    applySeed(randomSeed());
    seatSpawn();
    renderMap();
  }
  var TITLE_MENU_SCALE = 3;
  var TITLE_MENU_ROW = TITLE_MENU_SCALE * CHARSET_SIZE + (isMobile ? 24 : 16);
  var shortView = () => CAMERA_HEIGHT < 560 && CAMERA_WIDTH > CAMERA_HEIGHT * 1.4;
  var titleScale = () => shortView() ? HUD_SCALE * 1.5 : HUD_SCALE * 2;
  var titleBottom = () => HUD_LINE + titleScale() * CHARSET_SIZE + (shortView() ? CHARSET_SIZE : HUD_LINE);
  var UNICORN_CLEARANCE = 165;
  var SEED_LABEL_SCALE = 2.4;
  var TITLE_MENU_PAD = CHARSET_SIZE * 2;
  function titleMenuLayout() {
    const items = titleMenuItems();
    const blockH = (items.length + 1) * TITLE_MENU_ROW;
    const chevronW = textWidth(">  ", TITLE_MENU_SCALE);
    const labelW = Math.max(...items.map((item) => textWidth(item.sizeLabel || item.label, TITLE_MENU_SCALE)), textWidth("Seed: " + runSeed, SEED_LABEL_SCALE));
    const blockW = chevronW + labelW;
    let left = CAMERA_WIDTH / 2 - blockW / 2;
    const lowerHalfTop = CAMERA_HEIGHT / 2;
    let top = lowerHalfTop + (CAMERA_HEIGHT - lowerHalfTop - blockH) / 2;
    const sideLeft = CAMERA_WIDTH / 2 + UNICORN_CLEARANCE;
    if (shortView() && sideLeft + blockW + TITLE_MENU_PAD <= CAMERA_WIDTH) {
      left = sideLeft + (CAMERA_WIDTH - TITLE_MENU_PAD - sideLeft - blockW) / 2;
      top = titleBottom() + (CAMERA_HEIGHT - titleBottom() - blockH) / 2;
    } else {
      top = Math.max(lowerHalfTop, Math.min(top, CAMERA_HEIGHT - blockH));
    }
    return items.map((item, i) => {
      const y0 = top + i * TITLE_MENU_ROW;
      return {
        ...item,
        textY: y0 + (TITLE_MENU_ROW - TITLE_MENU_SCALE * CHARSET_SIZE) / 2,
        chevronX: left,
        labelX: left + chevronW,
        x0: left - TITLE_MENU_PAD,
        x1: left + blockW + TITLE_MENU_PAD,
        y0,
        y1: y0 + TITLE_MENU_ROW
      };
    });
  }
  var TITLE_JUMP_RX = 60;
  var TITLE_JUMP_RY = 100;
  var TITLE_JUMP_DURATION = 0.5;
  var titleJumpT = 0;
  var titleJumping = false;
  function beginTitleJump() {
    titleJumping = true;
  }
  function updateTitleJump() {
    titleJumpT = Math.min(1, titleJumpT + elapsedTime / TITLE_JUMP_DURATION);
    if (titleJumpT >= 1) {
      titleJumping = false;
      startGame();
    }
  }
  var easeTitleJump = (t) => t * t * (3 - 2 * t);
  function titleJumpPose() {
    const t = easeTitleJump(titleJumpT);
    const theta = Math.PI * (1 - t);
    return {
      // rests to the right of the true spawn (opposite side from Iris/her
      // bubble - see titleBubbleLayout) and hops left into position.
      x: TITLE_JUMP_RX - TITLE_JUMP_RX * Math.cos(theta),
      y: -TITLE_JUMP_RY * Math.sin(theta),
      // 0 (upright) at rest -> -PI/2 (nose down, mid-dive) on landing, purely
      // cosmetic - see drawUnicornSprite.
      angle: -t * Math.PI / 2,
      // drawHero's own convention (0 = facing right, PI/2 = facing down - see
      // hero.angle) rather than drawUnicornSprite's: -PI/2 (facing up) at rest,
      // sweeping the LONG way round (through 0/-PI rather than climbing
      // straight to PI/2) so it reads as a front-flip, not a backflip - lands
      // on -3PI/2, same on-screen orientation as PI/2 (rotation is mod 2PI)
      // and so still exactly hero.angle's value the instant GAME_SCREEN takes
      // over - the hop still hands off to real gameplay rendering with no snap.
      // Used while titleJumping (the ragdoll takes over from the static sprite
      // for the hop - see render()'s TITLE_SCREEN case).
      drillAngle: -Math.PI / 2 - t * Math.PI
    };
  }
  var highscoreReady;
  var highscoreIndex = 0;
  function goHighscores() {
    screen = HIGHSCORE_SCREEN;
    highscoreReady = false;
    highscoreIndex = 0;
  }
  var HIGHSCORE_MAX = 7;
  var HS_SCALE = 2.5;
  var HS_ROW = HS_SCALE * CHARSET_SIZE + (isMobile ? 16 : 10);
  var HS_COL_GAP = CHARSET_SIZE * 2;
  var HS_HEADERS = ["Seed", "Score", "Date"];
  function highscoreRows() {
    const table = load("highscores") || {};
    return Object.keys(table).map((seed) => ({ seed, score: computeScore(table[seed].dust, table[seed].shaft), date: table[seed].date })).sort((a, b) => b.score - a.score);
  }
  var HS_BACK_LABEL = "Back to main menu";
  function highscoreLayout() {
    const data = highscoreRows();
    const cols = [
      ["Seed", ...data.map((r) => r.seed)],
      ["Score", ...data.map((r) => "" + r.score)],
      ["Date", ...data.map((r) => r.date)]
    ];
    const colW = cols.map((vals) => Math.max(...vals.map((v) => textWidth(v, HS_SCALE))));
    const chevronW = textWidth(">  ", HS_SCALE);
    const tableW = Math.max(chevronW + colW[0] + colW[1] + colW[2] + HS_COL_GAP * 2, chevronW + textWidth(HS_BACK_LABEL, HS_SCALE));
    const left = CAMERA_WIDTH / 2 - tableW / 2;
    const colX = [left + chevronW, left + chevronW + colW[0] + HS_COL_GAP, left + chevronW + colW[0] + colW[1] + HS_COL_GAP * 2];
    const top = Math.max(titleBottom() - HUD_LINE / 2, Math.min(CAMERA_HEIGHT / 2 + HS_ROW, CAMERA_HEIGHT - (data.length + 3) * HS_ROW - 4));
    const rowBox = (y0) => ({ chevronX: left, x0: left - TITLE_MENU_PAD, x1: left + tableW + TITLE_MENU_PAD, y0, y1: y0 + HS_ROW });
    const rows = data.map((r, i) => ({ ...r, ...rowBox(top + (i + 1) * HS_ROW) }));
    rows.push({ back: true, label: HS_BACK_LABEL, ...rowBox(top + (data.length + 2) * HS_ROW) });
    return { rows, colX, top };
  }
  function selectSeed(seed) {
    applySeed(seed);
    seatSpawn();
    renderMap();
    screen = TITLE_SCREEN;
    titleIndex = 0;
  }
  function selectRow(row) {
    if (row.back) goTitle();
    else selectSeed(row.seed);
  }
  function goTitle() {
    DUG.clear();
    FILLED2.clear();
    hero = newHero();
    seatSpawn();
    renderMap();
    titleJumpT = 0;
    titleJumping = false;
    screen = TITLE_SCREEN;
    titleArmed = false;
  }
  function endMenuItems() {
    return [
      { label: "Try again", action: startGame },
      { label: "Back to main menu", action: goTitle }
    ];
  }
  function endMenuLayout() {
    const items = endMenuItems();
    const chevronW = textWidth(">  ", TITLE_MENU_SCALE);
    const labelW = Math.max(...items.map((item) => textWidth(item.label, TITLE_MENU_SCALE)));
    const blockW = chevronW + labelW;
    const left = CAMERA_WIDTH / 2 - blockW / 2;
    const top = CAMERA_HEIGHT / 2 + 3 * HUD_LINE;
    return items.map((item, i) => {
      const y0 = top + i * TITLE_MENU_ROW;
      return {
        ...item,
        textY: y0 + (TITLE_MENU_ROW - TITLE_MENU_SCALE * CHARSET_SIZE) / 2,
        chevronX: left,
        labelX: left + chevronW,
        x0: left - TITLE_MENU_PAD,
        x1: left + blockW + TITLE_MENU_PAD,
        y0,
        y1: y0 + TITLE_MENU_ROW
      };
    });
  }
  var BUBBLE_SCALE = 2;
  var BUBBLE_LINE = BUBBLE_SCALE * CHARSET_SIZE + 6;
  var BUBBLE_PAD = 14;
  var BUBBLE_RADIUS = 12;
  var BUBBLE_MARGIN = 10;
  var BUBBLE_LINES = [
    "I have a message to deliver.",
    "Collect dust to grow a",
    "rainbow bridge for me.",
    "",
    isMobile ? "Drag anywhere to steer" : "Steer with arrow keys or WASD"
  ];
  function titleBubbleLayout() {
    const surfaceLine = CAMERA_HEIGHT / 2;
    if (shortView()) {
      const scale = BUBBLE_SCALE * 0.85, line = scale * CHARSET_SIZE + 5;
      const lines = BUBBLE_LINES.filter(Boolean);
      const w2 = Math.max(...lines.map((l) => textWidth(l, scale))) + BUBBLE_PAD * 2;
      const h2 = lines.length * line + BUBBLE_PAD * 2;
      const irisX = Math.max(CAMERA_WIDTH / 2 - CAMERA_WIDTH * 0.15, BUBBLE_MARGIN + w2 + 12 + IRIS_W * IRIS_SCALE / 2);
      const x3 = irisX - IRIS_W * IRIS_SCALE / 2 - 12 - w2;
      const y2 = Math.max(titleBottom(), surfaceLine - IRIS_H * IRIS_SCALE * 0.6 - h2);
      return { x: x3, y: y2, w: w2, h: h2, textX: x3 + w2 / 2, irisX, lines, scale, line, tail: "right" };
    }
    const textW = Math.max(...BUBBLE_LINES.map((line) => textWidth(line, BUBBLE_SCALE)));
    const textH = BUBBLE_LINES.length * BUBBLE_LINE;
    const w = textW + BUBBLE_PAD * 2, h = textH + BUBBLE_PAD * 2;
    const cx = CAMERA_WIDTH / 2 - CAMERA_WIDTH * 0.15, cy = (titleBottom() + surfaceLine) / 2;
    const x2 = clamp(cx - w / 2, BUBBLE_MARGIN, CAMERA_WIDTH - BUBBLE_MARGIN - w);
    return { x: x2, y: cy - h / 2, w, h, textX: x2 + w / 2, irisX: x2 + w / 2, lines: BUBBLE_LINES, scale: BUBBLE_SCALE, line: BUBBLE_LINE, tail: "down" };
  }
  var irisWorldX;
  var irisGroundOffset = 0;
  var SPRITE_SIZE = 28;
  var IRIS_SPRITE_X = 28;
  var IRIS_W = 22;
  var IRIS_H = 28;
  var IRIS_SCALE = 2;
  var UNICORN_SPRITE_X = 0;
  var UNICORN_SCALE = 2;
  function seatIris(bubbleTextX) {
    irisWorldX = cameraX + bubbleTextX + mapOffsetX;
  }
  function drawIris() {
    const w = IRIS_W * IRIS_SCALE, h = IRIS_H * IRIS_SCALE;
    BUFFER_CTX.drawImage(sprites, IRIS_SPRITE_X, 0, IRIS_W, IRIS_H, irisWorldX - mapOffsetX - w / 2, SURFACE_Y - mapOffset - h + irisGroundOffset, w, h);
  }
  var irisFromX;
  var irisToX;
  var irisWalkT;
  var irisArc;
  var irisRideT;
  var IRIS_WALK_DURATION = REWIND_DURATION * 1.6;
  var IRIS_RIDE_SPEED = 700;
  function walkIrisTo(x2) {
    irisFromX = irisWorldX;
    irisToX = x2;
    irisWalkT = 0;
  }
  function updateIrisWalk() {
    if (irisWalkT === void 0) return;
    irisWalkT += elapsedTime;
    if (irisWalkT >= IRIS_WALK_DURATION) {
      irisWorldX = irisToX;
      irisWalkT = void 0;
      if (irisArc) irisRideT = 0;
      return;
    }
    irisWorldX = lerp(irisFromX, irisToX, irisWalkT / IRIS_WALK_DURATION);
  }
  function updateIrisRide() {
    if (irisRideT === void 0) return;
    irisRideT += elapsedTime;
    const t = clamp(irisRideT / irisArc.duration, 0, 1);
    const theta = Math.PI + t * Math.PI;
    irisWorldX = irisArc.cx + irisArc.r * Math.cos(theta);
    irisGroundOffset = irisArc.r * Math.sin(theta);
    if (t >= 1) {
      irisRideT = irisArc = void 0;
      irisGroundOffset = 0;
    }
  }
  function processInputs() {
    if (isKeyUp("KeyM")) cycleVolume();
    switch (screen) {
      case TITLE_SCREEN: {
        if (titleJumping) break;
        if (!anyKeyDown() && !isPointerDown()) titleArmed = true;
        if (!titleArmed) break;
        const items = titleMenuLayout();
        if (isKeyUp("ArrowUp")) titleIndex = (titleIndex - 1 + items.length) % items.length;
        if (isKeyUp("ArrowDown")) titleIndex = (titleIndex + 1) % items.length;
        if (isKeyUp("Enter") || isKeyUp("Space")) items[titleIndex].action();
        if (isPointerUp()) {
          const [px, py] = pointerViewportPosition();
          const hit = items.findIndex((it) => px >= it.x0 && px <= it.x1 && py >= it.y0 && py <= it.y1);
          if (hit >= 0) {
            titleIndex = hit;
            items[hit].action();
          }
        }
        break;
      }
      case GAME_SCREEN: {
        let dx = 0, dy = 0;
        if (isPointerDown()) {
          [dx, dy] = pointerDirection();
        } else {
          dx = (isKeyDown("ArrowRight", "KeyD") ? 1 : 0) - (isKeyDown("ArrowLeft", "KeyA", "KeyQ") ? 1 : 0);
          dy = (isKeyDown("ArrowDown", "KeyS") ? 1 : 0) - (isKeyDown("ArrowUp", "KeyW") ? 1 : 0);
        }
        const len = Math.hypot(dx, dy);
        if (len) {
          dx /= len;
          dy /= len;
        }
        const breach = SURFACE_Y - mapOffset - hero.y - hero.h;
        if (!heroWentDeep && breach > hero.h) dy = 1;
        let target;
        if (dx || dy) target = Math.atan2(dy, dx);
        if (target !== void 0) {
          const d = Math.atan2(Math.sin(target - hero.angle), Math.cos(target - hero.angle));
          const step = TURN_SPEED * elapsedTime;
          hero.angle += clamp(d, -step, step);
        }
        break;
      }
      case REWIND_SCREEN:
        if (!anyKeyDown() && !isPointerDown()) rewindArmed = true;
        if (rewindArmed && (anyKeyDown() || isPointerDown())) rewindSkip = true;
        break;
      case END_SCREEN: {
        if (!anyKeyDown() && !isPointerDown()) endArmed = true;
        if (!endArmed) break;
        const items = endMenuLayout();
        if (isKeyUp("ArrowUp")) endIndex = (endIndex - 1 + items.length) % items.length;
        if (isKeyUp("ArrowDown")) endIndex = (endIndex + 1) % items.length;
        if (isKeyUp("Enter") || isKeyUp("Space")) items[endIndex].action();
        if (isKeyUp("Escape")) goTitle();
        if (isPointerUp()) {
          const [px, py] = pointerViewportPosition();
          const hit = items.findIndex((it) => px >= it.x0 && px <= it.x1 && py >= it.y0 && py <= it.y1);
          if (hit >= 0) {
            endIndex = hit;
            items[hit].action();
          }
        }
        break;
      }
      case HIGHSCORE_SCREEN: {
        if (!anyKeyDown() && !isPointerDown()) highscoreReady = true;
        if (!highscoreReady) break;
        const { rows } = highscoreLayout();
        if (isKeyUp("ArrowUp")) highscoreIndex = (highscoreIndex - 1 + rows.length) % rows.length;
        if (isKeyUp("ArrowDown")) highscoreIndex = (highscoreIndex + 1) % rows.length;
        if (isKeyUp("Enter") || isKeyUp("Space")) selectRow(rows[highscoreIndex]);
        if (isKeyUp("Escape")) goTitle();
        if (isPointerUp()) {
          const [px, py] = pointerViewportPosition();
          const hit = rows.findIndex((r) => px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1);
          if (hit >= 0) {
            highscoreIndex = hit;
            selectRow(rows[hit]);
          }
        }
        break;
      }
    }
  }
  function update() {
    processInputs();
    if (screen === GAME_SCREEN) {
      moveHero();
      if (screen === GAME_SCREEN) {
        digShaft();
        followCamera(true);
        recordTrail();
      }
    }
    if (screen === TITLE_SCREEN && titleJumping) updateTitleJump();
    if (screen === REWIND_SCREEN) updateRewind();
    if (screen === END_SCREEN) rainbowT += elapsedTime;
    updateParticles();
    updateIrisWalk();
    updateIrisRide();
    updateMusic();
  }
  function drillWorld() {
    return [hero.x + hero.w / 2 + mapOffsetX, hero.y + hero.h / 2 - SURFACE_Y + mapOffset];
  }
  function recordTrail() {
    const [wx, wy] = drillWorld();
    const n = trail.length;
    if (Math.hypot(wx - trail[n - 2], wy - trail[n - 1]) >= TRAIL_STEP) trail.push(wx, wy);
  }
  function drillEdge() {
    const r = hero.w / 2;
    return [
      hero.x + hero.w / 2 + Math.cos(hero.angle) * (r + CELL_SIZE) + mapOffsetX,
      hero.y + hero.h / 2 + Math.sin(hero.angle) * (r + CELL_SIZE) - SURFACE_Y + mapOffset
    ];
  }
  function currentDrag() {
    const [ex, ey] = drillEdge();
    if (ey < 0) return MOMENTUM.airDrag;
    return MOMENTUM.entropy + (DUG.has(cellKey(ex, ey)) ? MOMENTUM.tunnelDrag : MATERIAL_DRAG[sampleMaterial(ex, ey)]);
  }
  function updateBodyLag() {
    const dAngle = Math.atan2(Math.sin(hero.angle - hero.prevAngle), Math.cos(hero.angle - hero.prevAngle));
    const angleVel = elapsedTime > 0 ? dAngle / elapsedTime : 0;
    hero.prevAngle = hero.angle;
    const target = clamp(-angleVel * BODY_LAG_LOOKAHEAD, -BODY_LAG_MAX, BODY_LAG_MAX);
    const k = BODY_LAG_STIFFNESS, z = BODY_LAG_DAMPING;
    for (let rem = Math.min(elapsedTime, 0.1); rem > 0; rem -= 1 / 120) {
      const h = Math.min(1 / 120, rem);
      hero.bodyLagVel += (k * k * (target - hero.bodyLagAngle) - 2 * z * k * hero.bodyLagVel) * h;
      hero.bodyLagAngle += hero.bodyLagVel * h;
    }
  }
  function moveHero() {
    hero.momentum = Math.max(0, hero.momentum - currentDrag() * elapsedTime);
    if (hero.momentum > MOMENTUM.max) {
      hero.momentum = MOMENTUM.max + (hero.momentum - MOMENTUM.max) * Math.exp(-MOMENTUM.overBleed * elapsedTime);
    }
    hero.velX = Math.cos(hero.angle);
    hero.velY = Math.sin(hero.angle);
    const moved = hero.momentum * elapsedTime;
    hero.x += hero.velX * moved;
    hero.y += hero.velY * moved;
    hero.tailPhase += moved * TAIL_WIGGLE_RATE;
    updateBodyLag();
    depth = Math.max(0, Math.round(hero.y + hero.h - SURFACE_Y + mapOffset));
    const [ex, ey] = drillEdge();
    if (ey >= 0 && !DUG.has(cellKey(ex, ey))) tunnel += moved;
    if (depth >= MOMENTUM.winMinDepth) heroWentDeep = true;
    if (heroWentDeep && depth <= 0 && hero.momentum > 0) return endGame(true);
    if (hero.momentum <= 0) return endGame(false);
  }
  function endGame(resurfaced) {
    hero.momentum = 0;
    for (const p of particles) if (!p.counted) {
      dust++;
      p.counted = true;
    }
    const shaft = Math.round(tunnel / PX_PER_M);
    score = computeScore(dust, shaft);
    const highscores = load("highscores") || {};
    const best = highscores[runSeed];
    if (!best || score > computeScore(best.dust, best.shaft)) {
      highscores[runSeed] = { date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), dust, shaft };
      const bySeed = Object.keys(highscores).sort((a, b) => computeScore(highscores[b].dust, highscores[b].shaft) - computeScore(highscores[a].dust, highscores[a].shaft));
      bySeed.filter((seed) => !PRESET_SEEDS.includes(seed)).slice(HIGHSCORE_MAX - PRESET_SEEDS.length).forEach((seed) => delete highscores[seed]);
      save("highscores", highscores);
    }
    outcome = resurfaced;
    endArmed = false;
    endIndex = 0;
    rainbowX = trail[0];
    rainbowX2 = void 0;
    rainbowT = 0;
    if (!dust && resurfaced) {
      rewound = false;
      screen = END_SCREEN;
      return;
    }
    trail.push(...drillWorld());
    if (resurfaced) {
      const egressX = trail[trail.length - 2];
      const sep = Math.abs(egressX - trail[0]);
      if (sep > CAMERA_WIDTH * RAINBOW_DOUBLE_MIN && sep < CAMERA_WIDTH * RAINBOW_DOUBLE_MAX) rainbowX2 = egressX;
    }
    if (dust) {
      irisArc = rainbowRideArc();
      walkIrisTo(irisArc.leftX - IRIS_W * IRIS_SCALE / 2);
    }
    rewound = true;
    let pathLen = 0;
    for (let i = 2; i < trail.length; i += 2) {
      pathLen += Math.hypot(trail[i] - trail[i - 2], trail[i + 1] - trail[i - 1]);
    }
    rewindI = trail.length / 2 - 1;
    rewindFillI = dust ? rewindI : 0;
    rewindT = 0;
    rewindSkip = false;
    rewindArmed = false;
    rewindSpeed = clamp(pathLen / REWIND_DURATION, 600, CAMERA_WIDTH * 8);
    if (dust) playSound(SFX_RAINBOW).playbackRate.value = SFX_RAINBOW_DURATION / (pathLen / rewindSpeed + RAINBOW_GROW);
    screen = REWIND_SCREEN;
  }
  function digShaft() {
    const [cx, cy] = drillWorld();
    const [px, py] = prevDrill;
    const n = Math.max(1, Math.ceil(Math.hypot(cx - px, cy - py) / CELL_SIZE));
    for (let i = 1; i <= n; i++) digDisc(lerp(px, cx, i / n), lerp(py, cy, i / n));
    prevDrill = [cx, cy];
  }
  function digDisc(cx, cy) {
    const r = hero.w / 2;
    for (let x2 = Math.floor((cx - r) / CELL_SIZE) * CELL_SIZE; x2 < cx + r; x2 += CELL_SIZE) {
      for (let y2 = Math.max(0, Math.floor((cy - r) / CELL_SIZE) * CELL_SIZE); y2 < cy + r; y2 += CELL_SIZE) {
        if (Math.hypot(x2 + CELL_SIZE / 2 - cx, y2 + CELL_SIZE / 2 - cy) <= r) dig(x2, y2);
      }
    }
  }
  function dig(worldX, undergroundY) {
    const key = worldX + "_" + undergroundY;
    if (!DUG.has(key)) {
      DUG.add(key);
      const bx = worldX - mapOffsetX, by = undergroundY + SURFACE_Y - mapOffset;
      MAP_CTX.fillStyle = TUNNEL_COLOR;
      MAP_CTX.fillRect(bx, by, CELL_SIZE, CELL_SIZE);
      DUST_MASK_CTX.clearRect(bx, by, CELL_SIZE, CELL_SIZE);
      const d = sampleDust(worldX, undergroundY);
      if (d !== DUST_NONE) {
        spawnDustParticle(worldX, undergroundY);
        playSound(SFX_DIG);
        if (d === DUST_DENSE) hero.momentum = Math.min(MOMENTUM.overMax, hero.momentum + MOMENTUM.denseBoost);
      }
    }
  }
  function dustColorAt(x2, undergroundY) {
    const phase = Math.floor(gameTime * DUST_SPEED);
    const i = Math.floor((x2 + CELL_SIZE / 2 + undergroundY + CELL_SIZE / 2 + phase) / DUST_BAND);
    return DUST_PALETTE[(i % DUST_PALETTE.length + DUST_PALETTE.length) % DUST_PALETTE.length];
  }
  function spawnDustParticle(worldX, undergroundY) {
    const cx = worldX - mapOffsetX + CELL_SIZE / 2;
    const cy = undergroundY + SURFACE_Y - mapOffset + CELL_SIZE / 2;
    const hx = hero.x + hero.w / 2, hy = hero.y + hero.h / 2;
    const dist = Math.hypot(cx - hx, cy - hy) || 1;
    const push = hero.w / 2 - dist + PARTICLE_PUSH_MARGIN;
    particles.push({
      x: cx,
      y: cy,
      pushX: (cx - hx) / dist * push,
      pushY: (cy - hy) / dist * push,
      stage: 0,
      t: 0,
      growDuration: PARTICLE_GROW_DURATION + (Math.random() - 0.5) * PARTICLE_DURATION_JITTER,
      flyDuration: PARTICLE_FLY_DURATION + (Math.random() - 0.5) * PARTICLE_DURATION_JITTER,
      color: dustColorAt(worldX, undergroundY),
      counted: false
      // set once its dust point has been tallied, by landing or by endGame() - guards against double-counting when both can happen
    });
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += elapsedTime;
      if (p.stage === 0) {
        if (p.t >= p.growDuration) {
          p.t -= p.growDuration;
          p.stage = 1;
          p.x0 = p.x + p.pushX - cameraX;
          p.y0 = p.y + p.pushY - cameraY;
        }
      } else if (p.t >= p.flyDuration) {
        if (!p.counted) {
          dust++;
          dustPop = gameTime;
          playSound(SFX_TALLY);
        }
        particles.splice(i, 1);
      }
    }
  }
  function centerCameraOn(bx, by, smooth) {
    const tx = bx - CAMERA_WIDTH / 2, ty = by - CAMERA_HEIGHT / 2;
    if (smooth) {
      const k = CAMERA_STIFFNESS, z = CAMERA_DAMPING;
      for (let rem = Math.min(elapsedTime, 0.1); rem > 0; rem -= 1 / 120) {
        const h = Math.min(1 / 120, rem);
        cameraVX += (k * k * (tx - cameraX) - 2 * z * k * cameraVX) * h;
        cameraVY += (k * k * (ty - cameraY) - 2 * z * k * cameraVY) * h;
        cameraX += cameraVX * h;
        cameraY += cameraVY * h;
      }
    } else {
      cameraX = tx;
      cameraY = ty;
      cameraVX = cameraVY = 0;
    }
    if (cameraX < 0 || cameraX > MAP.width - CAMERA_WIDTH) {
      const margin = (MAP.width - CAMERA_WIDTH) / 2;
      scrollMap(Math.round((cameraX - margin) / CELL_SIZE) * CELL_SIZE, 0);
    }
    if (cameraY < 0 || cameraY > MAP.height - CAMERA_HEIGHT) {
      const margin = (MAP.height - CAMERA_HEIGHT) / 2;
      scrollMap(0, Math.round((cameraY - margin) / CELL_SIZE) * CELL_SIZE);
    }
  }
  function followCamera(smooth) {
    const vx = hero.momentum * hero.velX, vy = hero.momentum * hero.velY;
    if (smooth) {
      const a = 1 - Math.exp(-elapsedTime / CAMERA_LOOKAHEAD_LAG);
      cameraFocusX = lerp(cameraFocusX, vx, a);
      cameraFocusY = lerp(cameraFocusY, vy, a);
    } else {
      cameraFocusX = vx;
      cameraFocusY = vy;
    }
    centerCameraOn(
      hero.x + hero.w / 2 + cameraFocusX * CAMERA_LOOKAHEAD,
      hero.y + hero.h / 2 + cameraFocusY * CAMERA_LOOKAHEAD,
      smooth
    );
  }
  function jumpCameraTo(wx, uy) {
    const dx = Math.round((wx - mapOffsetX - MAP.width / 2) / CELL_SIZE) * CELL_SIZE;
    const dy = Math.round((uy + SURFACE_Y - mapOffset - MAP.height / 2) / CELL_SIZE) * CELL_SIZE;
    hero.x -= dx;
    mapOffsetX += dx;
    hero.y -= dy;
    mapOffset += dy;
    for (const p of particles) if (p.stage === 0) {
      p.x -= dx;
      p.y -= dy;
    }
    cameraX = wx - mapOffsetX - CAMERA_WIDTH / 2;
    cameraY = uy + SURFACE_Y - mapOffset - CAMERA_HEIGHT / 2;
    cameraVX = cameraVY = 0;
    renderMap();
  }
  function updateRewind() {
    let step = rewindSkip ? Infinity : rewindSpeed * Math.min(elapsedTime, 0.1);
    while (step > 0 && rewindI > 0) {
      const ax = trail[2 * rewindI], ay = trail[2 * rewindI + 1];
      const bx = trail[2 * rewindI - 2], by = trail[2 * rewindI - 1];
      const seg = Math.hypot(bx - ax, by - ay) || 1;
      const left = (1 - rewindT) * seg;
      if (step < left) {
        rewindT += step / seg;
        step = 0;
      } else {
        step -= left;
        rewindI--;
        rewindT = 0;
      }
    }
    while (rewindFillI > rewindI) {
      fillTrailSeg(
        trail[2 * rewindFillI],
        trail[2 * rewindFillI + 1],
        trail[2 * rewindFillI - 2],
        trail[2 * rewindFillI - 1]
      );
      rewindFillI--;
    }
    if (rewindI === 0) {
      const hx = rainbowX2 === void 0 ? trail[0] : (rainbowX + rainbowX2) / 2;
      const hy = rainbowX2 === void 0 ? trail[1] : 0;
      const bx = hx - mapOffsetX, by = hy + SURFACE_Y - mapOffset;
      if (!rewindSkip && Math.hypot(bx - CAMERA_WIDTH / 2 - cameraX, by - CAMERA_HEIGHT / 2 - cameraY) > CAMERA_DEADZONE) {
        centerCameraOn(bx, by, true);
        return;
      }
      jumpCameraTo(hx, hy);
      endArmed = false;
      screen = END_SCREEN;
      return;
    }
    const j = rewindI - 1;
    const wx = lerp(trail[2 * rewindI], trail[2 * j], rewindT);
    const wy = lerp(trail[2 * rewindI + 1], trail[2 * j + 1], rewindT);
    centerCameraOn(wx - mapOffsetX, wy + SURFACE_Y - mapOffset, true);
  }
  function fillTrailSeg(ax, ay, bx, by) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / CELL_SIZE));
    for (let i = 0; i <= n; i++) fillDust(lerp(ax, bx, i / n), lerp(ay, by, i / n));
  }
  function fillDust(wx, wy) {
    const r = hero.w;
    DUST_MASK_CTX.fillStyle = "#fff";
    for (let x2 = Math.floor((wx - r) / CELL_SIZE) * CELL_SIZE; x2 < wx + r; x2 += CELL_SIZE) {
      for (let y2 = Math.max(0, Math.floor((wy - r) / CELL_SIZE) * CELL_SIZE); y2 < wy + r; y2 += CELL_SIZE) {
        const key = x2 + "_" + y2;
        if (DUG.has(key) && !FILLED2.has(key) && Math.hypot(x2 + CELL_SIZE / 2 - wx, y2 + CELL_SIZE / 2 - wy) <= r) {
          FILLED2.add(key);
          DUST_MASK_CTX.fillRect(x2 - mapOffsetX, y2 + SURFACE_Y - mapOffset, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }
  function scrollMap(dx, dy) {
    if (!dx && !dy) return;
    if (dy > 0) {
      MAP_CTX.drawImage(MAP, 0, dy, MAP.width, MAP.height - dy, 0, 0, MAP.width, MAP.height - dy);
      DUST_MASK_CTX.globalCompositeOperation = "copy";
      DUST_MASK_CTX.drawImage(DUST_MASK, 0, dy, MAP.width, MAP.height - dy, 0, 0, MAP.width, MAP.height - dy);
      DUST_MASK_CTX.globalCompositeOperation = "source-over";
      mapOffset += dy;
      for (let y2 = MAP.height - dy; y2 < MAP.height; y2 += CELL_SIZE) paintRow(y2);
    } else if (dy < 0) {
      MAP_CTX.drawImage(MAP, 0, 0, MAP.width, MAP.height + dy, 0, -dy, MAP.width, MAP.height + dy);
      DUST_MASK_CTX.globalCompositeOperation = "copy";
      DUST_MASK_CTX.drawImage(DUST_MASK, 0, 0, MAP.width, MAP.height + dy, 0, -dy, MAP.width, MAP.height + dy);
      DUST_MASK_CTX.globalCompositeOperation = "source-over";
      mapOffset += dy;
      for (let y2 = 0; y2 < -dy; y2 += CELL_SIZE) paintRow(y2);
    }
    if (dx > 0) {
      MAP_CTX.drawImage(MAP, dx, 0, MAP.width - dx, MAP.height, 0, 0, MAP.width - dx, MAP.height);
      DUST_MASK_CTX.globalCompositeOperation = "copy";
      DUST_MASK_CTX.drawImage(DUST_MASK, dx, 0, MAP.width - dx, MAP.height, 0, 0, MAP.width - dx, MAP.height);
      DUST_MASK_CTX.globalCompositeOperation = "source-over";
      mapOffsetX += dx;
      for (let x2 = MAP.width - dx; x2 < MAP.width; x2 += CELL_SIZE) paintCol(x2);
    } else if (dx < 0) {
      MAP_CTX.drawImage(MAP, 0, 0, MAP.width + dx, MAP.height, -dx, 0, MAP.width + dx, MAP.height);
      DUST_MASK_CTX.globalCompositeOperation = "copy";
      DUST_MASK_CTX.drawImage(DUST_MASK, 0, 0, MAP.width + dx, MAP.height, -dx, 0, MAP.width + dx, MAP.height);
      DUST_MASK_CTX.globalCompositeOperation = "source-over";
      mapOffsetX += dx;
      for (let x2 = 0; x2 < -dx; x2 += CELL_SIZE) paintCol(x2);
    }
    hero.x -= dx;
    hero.y -= dy;
    cameraX -= dx;
    cameraY -= dy;
    for (const p of particles) if (p.stage === 0) {
      p.x -= dx;
      p.y -= dy;
    }
  }
  function reanchorBuffer() {
    if (screen === REWIND_SCREEN) {
      screen = END_SCREEN;
      rewound = false;
      rainbowX2 = void 0;
    }
    const dx = Math.round((hero.x - MAP.width / 2) / CELL_SIZE) * CELL_SIZE;
    const dy = Math.round((hero.y - MAP.height / 2) / CELL_SIZE) * CELL_SIZE;
    hero.x -= dx;
    mapOffsetX += dx;
    hero.y -= dy;
    mapOffset += dy;
    followCamera();
    for (const p of particles) if (p.stage === 0) {
      p.x -= dx;
      p.y -= dy;
    }
    renderMap();
  }
  function blit() {
    CTX.drawImage(
      BUFFER,
      Math.floor(cameraX),
      cameraY,
      CAMERA_WIDTH,
      CAMERA_HEIGHT,
      0,
      0,
      c.width,
      c.height
    );
    CTX.drawImage(
      TEXT,
      0,
      0,
      TEXT.width,
      TEXT.height,
      0,
      0,
      c.width,
      c.height
    );
  }
  function clearBuffer() {
    const bx = Math.floor(cameraX), by = Math.floor(cameraY);
    BUFFER_CTX.drawImage(MAP, bx, by, CAMERA_WIDTH + 1, CAMERA_HEIGHT + 1, bx, by, CAMERA_WIDTH + 1, CAMERA_HEIGHT + 1);
  }
  function render() {
    clearTextBuffer();
    switch (screen) {
      case TITLE_SCREEN:
        clearBuffer();
        renderDust();
        {
          const pose = titleJumpPose();
          if (titleJumping) drawHeroJump(pose.x, pose.y, pose.drillAngle);
          else drawUnicornSprite(pose.x, pose.y, pose.angle);
        }
        renderText("Errands of Iris", CAMERA_WIDTH / 2, HUD_LINE, ALIGN_CENTER, titleScale());
        {
          const bubble = titleBubbleLayout();
          seatIris(bubble.irisX);
          drawIris();
          renderBubble(bubble.x, bubble.y, bubble.w, bubble.h, BUBBLE_RADIUS, bubble.tail);
          bubble.lines.forEach((line, i) => {
            renderText(line, bubble.textX, bubble.y + BUBBLE_PAD + i * bubble.line, ALIGN_CENTER, bubble.scale, "#000");
          });
        }
        {
          const menu = titleMenuLayout();
          menu.forEach((item, i) => {
            if (i === titleIndex) renderText(">", item.chevronX, item.textY, ALIGN_LEFT, TITLE_MENU_SCALE);
            renderText(item.label, item.labelX, item.textY, ALIGN_LEFT, TITLE_MENU_SCALE);
          });
          const last = menu[menu.length - 1];
          renderText("Seed: " + runSeed, last.labelX, last.textY + TITLE_MENU_ROW + (TITLE_MENU_SCALE - SEED_LABEL_SCALE) * CHARSET_SIZE / 2, ALIGN_LEFT, SEED_LABEL_SCALE);
        }
        break;
      case GAME_SCREEN:
        clearBuffer();
        renderDust();
        renderParticles();
        drawIris();
        drawHero();
        renderHud();
        break;
      case REWIND_SCREEN:
        clearBuffer();
        renderDust();
        renderParticles();
        drawIris();
        break;
      case END_SCREEN:
        clearBuffer();
        if (rainbowX2 !== void 0) renderDoubleRainbow(rainbowX2, rainbowX);
        else renderRainbow(rainbowX);
        renderDust();
        renderParticles();
        drawIris();
        if (!rewound) drawHero();
        renderHud();
        renderText(rainbowX2 !== void 0 ? "Double rainbow!" : dust ? "Well dug!" : "Dry run!", CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2 - 2 * HUD_LINE, ALIGN_CENTER, HUD_SCALE + 1);
        renderText("Score: " + score, CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2 + HUD_LINE, ALIGN_CENTER, HUD_SCALE);
        endMenuLayout().forEach((item, i) => {
          if (i === endIndex) renderText(">", item.chevronX, item.textY, ALIGN_LEFT, TITLE_MENU_SCALE);
          renderText(item.label, item.labelX, item.textY, ALIGN_LEFT, TITLE_MENU_SCALE);
        });
        break;
      case HIGHSCORE_SCREEN:
        clearBuffer();
        renderDust();
        {
          const pose = titleJumpPose();
          drawUnicornSprite(pose.x, pose.y, pose.angle);
        }
        renderText("High scores", CAMERA_WIDTH / 2, HUD_LINE, ALIGN_CENTER, titleScale());
        {
          const { rows, colX, top } = highscoreLayout();
          HS_HEADERS.forEach((h, c2) => renderText(h, colX[c2], top, ALIGN_LEFT, HS_SCALE));
          rows.forEach((r, i) => {
            if (i === highscoreIndex) renderText(">", r.chevronX, r.y0, ALIGN_LEFT, HS_SCALE);
            if (r.back) renderText(r.label, colX[0], r.y0, ALIGN_LEFT, HS_SCALE);
            else {
              renderText(r.seed, colX[0], r.y0, ALIGN_LEFT, HS_SCALE);
              renderText("" + r.score, colX[1], r.y0, ALIGN_LEFT, HS_SCALE);
              renderText(r.date, colX[2], r.y0, ALIGN_LEFT, HS_SCALE);
            }
          });
        }
        break;
    }
    blit();
    if (DEBUG_CAMERA && (screen === GAME_SCREEN || screen === REWIND_SCREEN)) {
      const s = c.width / CAMERA_WIDTH;
      const mx = c.width / 2, my = c.height / 2, r = CAMERA_DEADZONE * s;
      CTX.strokeStyle = "rgba(255,255,255,.4)";
      CTX.lineWidth = 1;
      CTX.beginPath();
      CTX.arc(mx, my, r, 0, 2 * Math.PI);
      CTX.moveTo(mx - r - 12, my);
      CTX.lineTo(mx + r + 12, my);
      CTX.moveTo(mx, my - r - 12);
      CTX.lineTo(mx, my + r + 12);
      CTX.stroke();
    }
    if (screen === GAME_SCREEN && isPointerDown()) {
      const [padX, padY, fingerX, fingerY, RAMP2, DEAD2] = pointerPad();
      const b = c.getBoundingClientRect();
      const k = c.width / b.width;
      CTX.save();
      CTX.scale(k, k);
      const ax = padX - b.left, ay = padY - b.top;
      const fx = fingerX - b.left, fy = fingerY - b.top;
      if (DEBUG_POINTER) {
        const [vx, vy] = pointerDirection();
        CTX.lineWidth = 2;
        CTX.fillStyle = "rgba(255,255,255,.12)";
        CTX.fillRect(ax - DEAD2, ay - RAMP2, 2 * DEAD2, 2 * RAMP2);
        CTX.fillRect(ax - RAMP2, ay - DEAD2, 2 * RAMP2, 2 * DEAD2);
        CTX.strokeStyle = "rgba(255,255,255,.55)";
        CTX.beginPath();
        CTX.arc(ax, ay, RAMP2, 0, 2 * Math.PI);
        CTX.stroke();
        const len = Math.hypot(vx, vy);
        if (len) {
          CTX.beginPath();
          CTX.moveTo(ax, ay);
          CTX.lineTo(ax + vx / len * RAMP2, ay + vy / len * RAMP2);
          CTX.stroke();
        }
        CTX.fillStyle = "rgba(255,255,255,.55)";
        CTX.beginPath();
        CTX.arc(fx, fy, 4, 0, 2 * Math.PI);
        CTX.fill();
      } else {
        CTX.fillStyle = "rgba(255,255,255,.25)";
        CTX.beginPath();
        CTX.arc(ax, ay, RAMP2 * Math.SQRT2, 0, 2 * Math.PI);
        CTX.fill();
        CTX.fillStyle = "rgba(255,255,255,.5)";
        CTX.beginPath();
        CTX.arc(fx, fy, RAMP2 * 0.4, 0, 2 * Math.PI);
        CTX.fill();
      }
      CTX.restore();
    }
  }
  function renderDust() {
    const cx = Math.floor(cameraX), cy = Math.floor(cameraY);
    DUST_LAYER_CTX.globalCompositeOperation = "copy";
    DUST_LAYER_CTX.drawImage(DUST_MASK, cx, cy, CAMERA_WIDTH, CAMERA_HEIGHT, 0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
    const phase = Math.floor(gameTime * DUST_SPEED);
    const tx = -(((cx + mapOffsetX) % DUST_P + DUST_P) % DUST_P);
    const ty = -(((cy - SURFACE_Y + mapOffset + phase) % DUST_P + DUST_P) % DUST_P);
    DUST_LAYER_CTX.globalCompositeOperation = "source-in";
    DUST_LAYER_CTX.fillStyle = DUST_PATTERN;
    DUST_LAYER_CTX.save();
    DUST_LAYER_CTX.translate(tx, ty);
    DUST_LAYER_CTX.fillRect(-tx, -ty, CAMERA_WIDTH, CAMERA_HEIGHT);
    DUST_LAYER_CTX.restore();
    DUST_LAYER_CTX.globalCompositeOperation = "source-over";
    BUFFER_CTX.drawImage(DUST_LAYER, 0, 0, CAMERA_WIDTH, CAMERA_HEIGHT, cx, cy, CAMERA_WIDTH, CAMERA_HEIGHT);
  }
  function arcBands(cx, cy, rOut, foot, sweep, flip, fromRight) {
    const band = foot / RAINBOW_BANDS;
    BUFFER_CTX.lineCap = "butt";
    for (let i = 0; i < RAINBOW_BANDS; i++) {
      BUFFER_CTX.strokeStyle = DUST_PALETTE[flip ? RAINBOW_BANDS - 1 - i : i];
      BUFFER_CTX.lineWidth = band + 1;
      BUFFER_CTX.beginPath();
      const r = rOut - foot + (RAINBOW_BANDS - 0.5 - i) * band;
      if (fromRight) BUFFER_CTX.arc(cx, cy, r, 0, -sweep, true);
      else BUFFER_CTX.arc(cx, cy, r, Math.PI, Math.PI + sweep);
      BUFFER_CTX.stroke();
    }
  }
  function rainbowSweep() {
    return (1 - (1 - clamp(rainbowT / RAINBOW_GROW, 0, 1)) ** 2) * Math.PI;
  }
  function rainbowRideArc() {
    const k = dust / (dust + RAINBOW_DUST_HALF);
    const foot = lerp(RAINBOW_FOOT_MIN, RAINBOW_FOOT_MAX, k);
    let cx, r;
    if (rainbowX2 === void 0) {
      r = lerp(RAINBOW_R_MIN, RAINBOW_R_MAX, k);
      cx = rainbowX + r - foot / 2;
    } else {
      const half = Math.abs(rainbowX2 - rainbowX) / 2;
      const dir = rainbowX2 < rainbowX ? 1 : -1;
      const rO = half * (1 + RAINBOW_DOUBLE_OVERSHOOT);
      const rI = half * (1 - RAINBOW_DOUBLE_OVERSHOOT);
      if (rainbowX2 > rainbowX) {
        const fs = Math.min(foot, rI * 0.5) * 0.55;
        r = rI + fs / 2;
        cx = rainbowX - dir * rI;
      } else {
        r = rO + Math.min(foot, rI * 0.5) / 2;
        cx = rainbowX2 + dir * rO;
      }
    }
    return { cx, r, leftX: cx - r, rightX: cx + r, duration: clamp(Math.PI * r / IRIS_RIDE_SPEED, 1.5, 6) };
  }
  function renderRainbow(footX) {
    if (!dust) return;
    const k = dust / (dust + RAINBOW_DUST_HALF);
    const R = lerp(RAINBOW_R_MIN, RAINBOW_R_MAX, k);
    const foot = lerp(RAINBOW_FOOT_MIN, RAINBOW_FOOT_MAX, k);
    arcBands(footX - mapOffsetX + R - foot / 2, SURFACE_Y - mapOffset, R, foot, rainbowSweep(), false, false);
  }
  function renderDoubleRainbow(egressX, ingressX) {
    if (!dust) return;
    const k = dust / (dust + RAINBOW_DUST_HALF);
    const cy = SURFACE_Y - mapOffset;
    const half = Math.abs(egressX - ingressX) / 2;
    const dir = egressX < ingressX ? 1 : -1;
    const rO = half * (1 + RAINBOW_DOUBLE_OVERSHOOT);
    const rI = half * (1 - RAINBOW_DOUBLE_OVERSHOOT);
    const foot = Math.min(lerp(RAINBOW_FOOT_MIN, RAINBOW_FOOT_MAX, k), rI * 0.5);
    const fs = foot * 0.55;
    const sweep = rainbowSweep();
    const egressRight = egressX > ingressX;
    arcBands(egressX - mapOffsetX + dir * rO, cy, rO + foot / 2, foot, sweep, true, egressRight);
    arcBands(ingressX - mapOffsetX - dir * rI, cy, rI + fs / 2, fs, sweep, false, !egressRight);
  }
  function renderParticles() {
    for (const p of particles) {
      let x2, y2, size;
      if (p.stage === 0) {
        const ease = 1 - (1 - Math.min(1, p.t / p.growDuration)) ** 2;
        x2 = p.x + p.pushX * ease;
        y2 = p.y + p.pushY * ease;
        size = lerp(PARTICLE_SIZE, PARTICLE_SIZE * 2, ease);
      } else {
        const ease = Math.min(1, p.t / p.flyDuration) ** 2;
        x2 = lerp(p.x0, DUST_COUNTER_X, ease) + cameraX;
        y2 = lerp(p.y0, DUST_COUNTER_Y, ease) + cameraY;
        size = PARTICLE_SIZE * 2;
      }
      BUFFER_CTX.fillStyle = p.color;
      BUFFER_CTX.fillRect(Math.round(x2 - size / 2), Math.round(y2 - size / 2), size, size);
    }
  }
  var DRILL_HEAD = { sx: 0, sy: 0, dx: 0, dy: 0, w: 16, h: 16 };
  var DRILL_BODY = { sx: 50, sy: 0, dx: 16, dy: 2, w: 17, h: 17 };
  var DRILL_TAIL = { sx: 50, sy: 17, dx: 31, dy: 8, w: 8, h: 5 };
  var DRILL_JOINT = { x: 16, y: 10 };
  var DRILL_TAIL_JOINT = { x: 31, y: 10 };
  var DRILL_SCALE = 2;
  var TAIL_WIGGLE_MAX = 15 * Math.PI / 180;
  function drawHero(offsetX = 0, offsetY = 0, angle = hero.angle) {
    const ctx2 = BUFFER_CTX;
    const s = DRILL_SCALE;
    ctx2.save();
    ctx2.translate(hero.x + hero.w / 2 + offsetX, hero.y + hero.h / 2 + offsetY);
    ctx2.rotate(angle);
    ctx2.scale(-s, -s);
    ctx2.drawImage(
      sprites,
      DRILL_HEAD.sx,
      DRILL_HEAD.sy,
      DRILL_HEAD.w,
      DRILL_HEAD.h,
      DRILL_HEAD.dx - DRILL_JOINT.x,
      DRILL_HEAD.dy - DRILL_JOINT.y,
      DRILL_HEAD.w,
      DRILL_HEAD.h
    );
    ctx2.rotate(hero.bodyLagAngle);
    ctx2.drawImage(
      sprites,
      DRILL_BODY.sx,
      DRILL_BODY.sy,
      DRILL_BODY.w,
      DRILL_BODY.h,
      DRILL_BODY.dx - DRILL_JOINT.x,
      DRILL_BODY.dy - DRILL_JOINT.y,
      DRILL_BODY.w,
      DRILL_BODY.h
    );
    ctx2.translate(DRILL_TAIL_JOINT.x - DRILL_JOINT.x, DRILL_TAIL_JOINT.y - DRILL_JOINT.y);
    ctx2.rotate(Math.sin(hero.tailPhase) * TAIL_WIGGLE_MAX);
    ctx2.drawImage(
      sprites,
      DRILL_TAIL.sx,
      DRILL_TAIL.sy,
      DRILL_TAIL.w,
      DRILL_TAIL.h,
      DRILL_TAIL.dx - DRILL_TAIL_JOINT.x,
      DRILL_TAIL.dy - DRILL_TAIL_JOINT.y,
      DRILL_TAIL.w,
      DRILL_TAIL.h
    );
    ctx2.restore();
  }
  function drawHeroJump(offsetX, offsetY, angle) {
    const ctx2 = BUFFER_CTX;
    const s = DRILL_SCALE;
    const bend = JUMP_BEND;
    ctx2.save();
    ctx2.translate(hero.x + hero.w / 2 + offsetX, hero.y + hero.h / 2 + offsetY);
    ctx2.rotate(angle);
    ctx2.scale(-s, -s);
    ctx2.drawImage(
      sprites,
      DRILL_HEAD.sx,
      DRILL_HEAD.sy,
      DRILL_HEAD.w,
      DRILL_HEAD.h,
      DRILL_HEAD.dx - DRILL_JOINT.x,
      DRILL_HEAD.dy - DRILL_JOINT.y,
      DRILL_HEAD.w,
      DRILL_HEAD.h
    );
    ctx2.rotate(bend);
    ctx2.drawImage(
      sprites,
      DRILL_BODY.sx,
      DRILL_BODY.sy,
      DRILL_BODY.w,
      DRILL_BODY.h,
      DRILL_BODY.dx - DRILL_JOINT.x,
      DRILL_BODY.dy - DRILL_JOINT.y,
      DRILL_BODY.w,
      DRILL_BODY.h
    );
    ctx2.translate(DRILL_TAIL_JOINT.x - DRILL_JOINT.x, DRILL_TAIL_JOINT.y - DRILL_JOINT.y);
    ctx2.rotate(bend);
    ctx2.drawImage(
      sprites,
      DRILL_TAIL.sx,
      DRILL_TAIL.sy,
      DRILL_TAIL.w,
      DRILL_TAIL.h,
      DRILL_TAIL.dx - DRILL_TAIL_JOINT.x,
      DRILL_TAIL.dy - DRILL_TAIL_JOINT.y,
      DRILL_TAIL.w,
      DRILL_TAIL.h
    );
    ctx2.restore();
  }
  function drawUnicornSprite(offsetX = 0, offsetY = 0, angle = 0) {
    const ctx2 = BUFFER_CTX;
    const w = SPRITE_SIZE * UNICORN_SCALE, h = SPRITE_SIZE * UNICORN_SCALE;
    ctx2.save();
    ctx2.translate(hero.x + hero.w / 2 + offsetX, hero.y + hero.h + offsetY);
    ctx2.rotate(angle);
    ctx2.drawImage(sprites, UNICORN_SPRITE_X, 0, SPRITE_SIZE, SPRITE_SIZE, -w / 2, -h, w, h);
    ctx2.restore();
  }
  function paintCell(x2, y2) {
    const wx = x2 + mapOffsetX;
    const underground = y2 - SURFACE_Y + mapOffset;
    const key = wx + "_" + underground;
    const dug = DUG.has(key);
    MAP_CTX.fillStyle = underground < 0 ? SKY_COLOR : dug ? TUNNEL_COLOR : materialColor(sampleMaterial(wx, underground));
    MAP_CTX.fillRect(x2, y2, CELL_SIZE, CELL_SIZE);
    if (underground >= 0 && (dug ? FILLED2.has(key) : sampleDust(wx, underground) !== DUST_NONE)) {
      DUST_MASK_CTX.fillRect(x2, y2, CELL_SIZE, CELL_SIZE);
    }
  }
  function paintRow(y2) {
    DUST_MASK_CTX.clearRect(0, y2, MAP.width, CELL_SIZE);
    DUST_MASK_CTX.fillStyle = "#fff";
    for (let x2 = 0; x2 < MAP.width; x2 += CELL_SIZE) paintCell(x2, y2);
  }
  function paintCol(x2) {
    DUST_MASK_CTX.clearRect(x2, 0, CELL_SIZE, MAP.height);
    DUST_MASK_CTX.fillStyle = "#fff";
    for (let y2 = 0; y2 < MAP.height; y2 += CELL_SIZE) paintCell(x2, y2);
  }
  function renderMap() {
    for (let y2 = 0; y2 < MAP.height; y2 += CELL_SIZE) paintRow(y2);
  }
  function loop() {
    if (running) {
      requestId = requestAnimationFrame(loop);
      currentTime = performance.now();
      elapsedTime = (currentTime - lastTime) / 1e3;
      gameTime += elapsedTime;
      update();
      render();
      lastTime = currentTime;
    }
  }
  function toggleLoop(value) {
    running = value;
    if (running) {
      lastTime = performance.now();
      resumeAudio();
      loop();
    } else {
      cancelAnimationFrame(requestId);
      suspendAudio();
    }
  }
  var SEED_DEFAULT = "OLYMPUS";
  var PRESET_SEEDS = ["OLYMPUS", "UNICORNS", "RAINBOWS"];
  var runSeed;
  function applySeed(seed) {
    setMapSeed(seed);
    runSeed = seed;
    try {
      const url = new URL(location);
      url.searchParams.set("seed", runSeed);
      history.replaceState({}, "", url);
    } catch (e) {
    }
  }
  function seedMap() {
    const raw = new URLSearchParams(location.search).get("seed");
    applySeed(raw ? raw.toUpperCase() : SEED_DEFAULT);
  }
  function initPresetSeeds() {
    const highscores = load("highscores") || {};
    let changed = false;
    for (const seed of Object.keys(highscores)) {
      if (seed.includes("-") || highscores[seed].dust === void 0) {
        delete highscores[seed];
        changed = true;
      }
    }
    for (const seed of PRESET_SEEDS) {
      if (!highscores[seed]) {
        highscores[seed] = { dust: 0, shaft: 0, date: "" };
        changed = true;
      }
    }
    if (changed) save("highscores", highscores);
  }
  onload = async (e) => {
    document.title = "Errands of Iris";
    initPresetSeeds();
    seedMap();
    onresize();
    seatSpawn();
    [tileset, sprites] = await Promise.all([loadImg(tileset_default), loadImg(sprites_default)]);
    renderMap();
    musicPlayer = renderSong(song_game_default);
    if (musicUnlocked) musicGame = songBuffer(musicPlayer);
    toggleLoop(true);
  };
  var musicPlayer;
  var UNLOCK_EVENTS = ["keydown", "pointerdown", "pointerup", "touchend"];
  var unlockMusic = () => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    if (!initAudio()) return;
    musicUnlocked = true;
    if (musicPlayer && !musicGame) musicGame = songBuffer(musicPlayer);
    resumeAudio();
    updateMusic();
    UNLOCK_EVENTS.forEach((type) => removeEventListener(type, unlockMusic));
  };
  UNLOCK_EVENTS.forEach((type) => addEventListener(type, unlockMusic));
  function resizeViewport() {
    const zoom = Math.min(
      (isMobile ? MOBILE_REF_DPR / (devicePixelRatio || 1) : 1) * RENDER_SCALE,
      innerWidth / VIEW_FIT_W,
      innerHeight / VIEW_FIT_H
    );
    const w = clamp(Math.round(innerWidth / zoom / CELL_SIZE) * CELL_SIZE, VIEW_MIN, VIEW_MAX);
    const h = clamp(Math.round(innerHeight / zoom / CELL_SIZE) * CELL_SIZE, VIEW_MIN, VIEW_MAX);
    if (w === CAMERA_WIDTH && h === CAMERA_HEIGHT) return false;
    CAMERA_WIDTH = w;
    CAMERA_HEIGHT = h;
    for (const buf of [BUFFER, MAP, DUST_MASK]) {
      buf.width = 2 * CAMERA_WIDTH;
      buf.height = 2 * CAMERA_HEIGHT;
    }
    DUST_LAYER.width = CAMERA_WIDTH;
    DUST_LAYER.height = CAMERA_HEIGHT;
    DUST_PATTERN = DUST_LAYER_CTX.createPattern(DUST_GRADIENT, "repeat");
    MAP_CTX.imageSmoothingEnabled = BUFFER_CTX.imageSmoothingEnabled = DUST_MASK_CTX.imageSmoothingEnabled = DUST_LAYER_CTX.imageSmoothingEnabled = false;
    return true;
  }
  onresize = onrotate = function() {
    const buffersChanged = resizeViewport();
    const scaleToFit = Math.min(innerWidth / CAMERA_WIDTH, innerHeight / CAMERA_HEIGHT);
    const dpr = Math.min(devicePixelRatio || 1, 3);
    let cssW = Math.round(CAMERA_WIDTH * scaleToFit), cssH = Math.round(CAMERA_HEIGHT * scaleToFit);
    if (Math.abs(innerWidth - cssW) <= 0.02 * innerWidth && Math.abs(innerHeight - cssH) <= 0.02 * innerHeight) {
      cssW = innerWidth;
      cssH = innerHeight;
    }
    c.style.width = cssW + "px";
    c.style.height = cssH + "px";
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    CTX.imageSmoothingEnabled = false;
    TEXT = initTextBuffer(c, CAMERA_WIDTH, CAMERA_HEIGHT, c.width / CAMERA_WIDTH);
    if (buffersChanged) reanchorBuffer();
    if (buffersChanged && screen < GAME_SCREEN) {
      seatSpawn();
      renderMap();
    }
    window.focus();
  };
  document.onvisibilitychange = function(e) {
    toggleLoop(!e.target.hidden);
  };
  addEventListener("keydown", (e) => {
    if (!e.repeat && screen === GAME_SCREEN && e.code === "KeyP") {
      toggleLoop(!running);
      if (!running) {
        CTX.save();
        CTX.fillStyle = "rgba(0,0,0,.45)";
        CTX.fillRect(0, 0, c.width, c.height);
        const size = Math.round(c.height / 10);
        CTX.font = `${size}px Impact, Roboto, sans-serif`;
        CTX.textAlign = "center";
        CTX.textBaseline = "middle";
        CTX.fillStyle = "#fff";
        CTX.fillText("Paused", c.width / 2, c.height / 2);
        CTX.font = `${Math.round(size / 3)}px Impact, Roboto, sans-serif`;
        CTX.fillText("Press P to resume", c.width / 2, c.height / 2 + size);
        CTX.restore();
      }
    }
  });
})();
