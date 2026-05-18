const STORAGE_KEYS = { STATE: "quiz.state.v1" };
const DATA_URL = "./data/questions.json";

class Question {
  constructor(dto) {
    this.id = dto.id; this.text = dto.text; this.options = dto.options; this.correctIndex = dto.correctIndex;
  }
}

class StorageService {
  static saveState(state) { localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state)); }
  static loadState() { const data = localStorage.getItem(STORAGE_KEYS.STATE); return data ? JSON.parse(data) : null; }
  static clear() { localStorage.removeItem(STORAGE_KEYS.STATE); }
}

class QuizEngine {
  constructor(quiz) {
    this.title = quiz.title; this.timeLimitSec = quiz.timeLimitSec; this.passThreshold = quiz.passThreshold;
    this.questions = quiz.questions.map((q) => new Question(q)); this.currentIndex = 0; this.answers = {};
    this.remainingSec = quiz.timeLimitSec; this.isFinished = false;
  }
  get length() { return this.questions.length; }
  get currentQuestion() { return this.questions[this.currentIndex]; }
  goTo(index) { if (index >= 0 && index < this.length) this.currentIndex = index; }
  next() { if (this.currentIndex < this.length - 1) this.currentIndex++; }
  prev() { if (this.currentIndex > 0) this.currentIndex--; }
  select(optionIndex) { const q = this.currentQuestion; if (q) this.answers[q.id] = optionIndex; }
  getSelectedIndex() { const q = this.currentQuestion; return q ? this.answers[q.id] : undefined; }
  tick() {
    if (this.isFinished) return;
    if (this.remainingSec > 0) {
      this.remainingSec--;
      if (this.remainingSec === 0) { const summary = this.finish(); stopTimer(); renderResult(summary); persist(); }
    }
  }
  finish() {
    this.isFinished = true; let correct = 0;
    this.questions.forEach((q) => { if (this.answers[q.id] === q.correctIndex) correct++; });
    const percent = this.length > 0 ? correct / this.length : 0;
    return { correct, total: this.length, percent, passed: percent >= this.passThreshold };
  }
  toState() { return { currentIndex: this.currentIndex, answers: this.answers, remainingSec: this.remainingSec, isFinished: this.isFinished }; }
  static fromState(quiz, state) {
    const eng = new QuizEngine(quiz); eng.currentIndex = state.currentIndex; eng.answers = state.answers; eng.remainingSec = state.remainingSec; eng.isFinished = state.isFinished; return eng;
  }
}

const $ = (sel) => document.querySelector(sel);
const els = {
  title: $("#quiz-title"), progress: $("#progress"), timer: $("#timer"), qText: $("#question-text"), form: $("#options-form"),
  btnPrev: $("#btn-prev"), btnNext: $("#btn-next"), btnFinish: $("#btn-finish"), result: $("#result-section"), resultSummary: $("#result-summary"),
  btnReview: $("#btn-review"), btnRestart: $("#btn-restart")
};

let engine = null; let timerId = undefined; let reviewMode = false;

document.addEventListener("DOMContentLoaded", async () => {
  const quiz = await loadQuiz(); els.title.textContent = quiz.title;
  const saved = StorageService.loadState();
  if (saved) { engine = QuizEngine.fromState(quiz, saved); } else { engine = new QuizEngine(quiz); }
  bindEvents(); if (engine.isFinished) { renderResult(engine.finish()); } else { startTimer(); } renderAll();
});

async function loadQuiz() { const res = await fetch(DATA_URL); return await res.json(); }
function startTimer() { stopTimer(); timerId = window.setInterval(() => { try { engine.tick(); persist(); renderTimer(); } catch { stopTimer(); } }, 1000); }
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = undefined; } }

function bindEvents() {
  els.btnPrev.addEventListener("click", () => { engine.prev(); persist(); renderAll(); });
  els.btnNext.addEventListener("click", () => { engine.next(); persist(); renderAll(); });
  els.btnFinish.addEventListener("click", () => { const s = engine.finish(); stopTimer(); renderResult(s); persist(); });
  els.btnReview.addEventListener("click", () => { reviewMode = true; renderAll(); });
  els.btnRestart.addEventListener("click", () => { StorageService.clear(); window.location.reload(); });
  els.form.addEventListener("change", (e) => { if (reviewMode || engine.isFinished) return; if (e.target.name === "option") { engine.select(Number(e.target.value)); persist(); renderNav(); } });
}

function renderAll() { renderProgress(); renderTimer(); renderQuestion(); renderNav(); }
function renderProgress() { els.progress.textContent = `Вопрос ${engine.currentIndex + 1} из ${engine.length}`; }
function renderTimer() { const sec = engine.remainingSec; els.timer.textContent = `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`; }
function renderQuestion() {
  els.qText.textContent = engine.currentQuestion.text; els.form.innerHTML = "";
  engine.currentQuestion.options.forEach((opt, i) => {
    const label = document.createElement("label"); label.className = "option";
    const chosen = engine.answers[engine.currentQuestion.id];
    if (reviewMode) {
      if (i === engine.currentQuestion.correctIndex) label.classList.add("correct");
      if (chosen === i && i !== engine.currentQuestion.correctIndex) label.classList.add("incorrect");
    }
    label.innerHTML = `<input type="radio" name="option" value="${i}" ${chosen === i ? "checked" : ""} ${reviewMode ? "disabled" : ""}><span>${opt}</span>`;
    els.form.appendChild(label);
  });
}
function renderNav() {
  const hasSel = engine.getSelectedIndex() !== undefined;
  els.btnPrev.disabled = engine.currentIndex === 0 || reviewMode;
  els.btnNext.disabled = !(engine.currentIndex < engine.length - 1 && hasSel) || reviewMode;
  els.btnFinish.disabled = !(engine.currentIndex === engine.length - 1 && hasSel) || reviewMode;
}
function renderResult(s) { els.result.classList.remove("hidden"); els.resultSummary.textContent = `${s.correct} / ${s.total} (${Math.round(s.percent * 100)}%) — ${s.passed ? "Пройден" : "Не пройден"}`; }
function persist() { try { StorageService.saveState(engine.toState()); } catch {} }
