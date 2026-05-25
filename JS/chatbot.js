// SmartCare | AI Health Chatbot Frontend (Python ML Backend)
// ===========================================================

const Chatbot = {
	container: null,
	input: null,
	sendBtn: null,
	messagesArea: null,
	typingIndicator: null,
	chatResizeHandle: null,
	newChatBtn: null,
	modeToggleBtn: null,
	floatResizeS: null, // south (bottom) handle
	floatResizeSe: null, // south-east (corner) handle
	popup: null,
	mode: "pinned", // 'pinned' | 'floating'
	sessionId: "session_" + Math.random().toString(36).substr(2, 9),

	getBackendUrl() {
		const isInHtmlFolder = window.location.pathname.includes("/HTML/");
		return (isInHtmlFolder ? "../" : "./") + "PHP/chatbot_api.php";
	},

	getHistoryUrl() {
		const isInHtmlFolder = window.location.pathname.includes("/HTML/");
		return (isInHtmlFolder ? "../" : "./") + "PHP/get_chat_history.php";
	},

	async init() {
		await this.injectUI();
		localStorage.setItem("smartcare_chat_session", this.sessionId);

		// ── FAB popup toggle (index.html) ──
		const fab = document.getElementById("chatbot-fab");
		this.popup = document.getElementById("chatbot-popup");
		const closeBtn = document.getElementById("close-chat");
		this.newChatBtn = document.getElementById("new-chat-btn");
		this.chatResizeHandle = document.getElementById("chat-resize-handle");

		if (fab && this.popup) {
			fab.onclick = () => this.popup.classList.toggle("visible");
		}

		// Handle any elements with .chat-button class
		document.addEventListener("click", (e) => {
			const chatBtn = e.target.closest(".chat-button");
			if (chatBtn && this.popup) {
				this.popup.classList.add("visible");
			}
		});

		if (closeBtn && this.popup) {
			closeBtn.onclick = () => this.popup.classList.remove("visible");
		}

		// ── History Sidebar ──
		const avatarDiv = this.popup
			? this.popup.querySelector(".chat-header-avatar")
			: null;
		const closeHistoryBtn = document.getElementById("close-history-btn");

		if (avatarDiv && this.popup) {
			avatarDiv.onclick = () => {
				this.popup.classList.add("history-open");
				this.fetchHistory();
			};
		}
		if (closeHistoryBtn && this.popup) {
			closeHistoryBtn.onclick = () =>
				this.popup.classList.remove("history-open");
		}

		// ── New Chat button ──
		if (this.newChatBtn) {
			this.newChatBtn.onclick = () => this.resetChat();
		}

		// ── Mode-toggle button (pinned ↔ floating) ──
		this.modeToggleBtn = document.getElementById("mode-toggle-btn");
		if (this.modeToggleBtn) {
			this.modeToggleBtn.onclick = () => this.toggleMode();
		}

		// ── Wire up chat UI elements (inside the popup only) ──
		if (this.popup) {
			this.container =
				this.popup.querySelector(".chat-container") ||
				this.popup.querySelector(".chat-content-column");
			this.messagesArea = this.popup.querySelector(".chat-messages");
			this.input = this.popup.querySelector(".chat-input");
			this.sendBtn = this.popup.querySelector(".send-message-btn");
			this.typingIndicator = this.popup.querySelector(".typing-indicator");
		}

		if (this.sendBtn && this.input) {
			this.sendBtn.onclick = () => this.sendMessage();
			this.input.onkeypress = (e) => {
				if (e.key === "Enter") this.sendMessage();
			};
		}

		// ── Resize & window-drag logic ──
		this.initResize();
		this.initWindowDrag();
		this.initFloatResize();

		this._setInputVisible(true);
		this._enableInput();
		this.resetChat();
	},

	showWelcomeMessage() {
		const isInHtmlFolder = window.location.pathname.includes("/HTML/");
		const basePath = isInHtmlFolder ? "../" : "./";
		// Prompt for basic profile first (name → age → gender) to match backend flow
		this.appendMessage(
			`<img src="${basePath}Assets/Icons/blue-chatbot.svg" alt="AI" style="width: 18px; height: 18px; vertical-align: bottom; margin-right: 6px;"> 🤖 Welcome to HealthCare ChatBot\nHello! Please answer a few questions so I can understand your condition better.\n\n👉 What is your name? :`,
			"bot",
		);
	},

	// Helper: remove leading asterisks and capitalize first letter for session titles
	formatSessionTitle(title) {
		if (!title || typeof title !== "string") return title || "";
		// remove leading '*' characters and any following spaces
		const cleaned = title.replace(/^\*+\s*/, "").trim();
		if (!cleaned) return "";
		return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	},

	// ── Inject Floating Chatbot HTML if not present ──
	async injectUI() {
		if (document.getElementById("chatbot-fab")) return; // Already in HTML (e.g. index.html)

		const isInHtmlFolder = window.location.pathname.includes("/HTML/");
		const basePath = isInHtmlFolder ? "../" : "./";

		try {
			const response = await fetch(basePath + "HTML/chatbot.html");
			if (!response.ok) throw new Error("Could not fetch chatbot HTML");
			let html = await response.text();
			html = html.replace(/\{\{basePath\}\}/g, basePath);
			document.body.insertAdjacentHTML("beforeend", html);
		} catch (error) {
			console.error("Failed to inject Chatbot UI:", error);
		}
	},

	// ── Toggle between pinned sidebar and floating window ──
	toggleMode() {
		const panel = this.popup;
		if (!panel) return;

		if (this.mode === "pinned") {
			// ── Switch to FLOATING ──
			this.mode = "floating";

			// Pick a good default position (centred in viewport)
			const vpW = window.innerWidth;
			const vpH = window.innerHeight;
			const panelW = panel.offsetWidth || 400;
			const panelH = 580;
			const left = Math.max(16, Math.round((vpW - panelW) / 2));
			const top = Math.max(16, Math.round((vpH - panelH) / 2));

			// Apply position before adding class so the panel doesn't flash
			panel.style.left = left + "px";
			panel.style.top = top + "px";
			panel.style.right = "auto";
			panel.style.bottom = "auto";

			panel.classList.add("floating");

			// Update button
			if (this.modeToggleBtn) {
				this.modeToggleBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>`;
				this.modeToggleBtn.title = "Dock to sidebar";
			}
		} else {
			// ── Switch to PINNED ──
			this.mode = "pinned";

			panel.classList.remove("floating");

			// Clear any inline position overrides so CSS takes over
			panel.style.left = "";
			panel.style.top = "";
			panel.style.right = "";
			panel.style.bottom = "";
			panel.style.height = "";
			panel.style.width = "";
			document.documentElement.style.removeProperty("--cb-width");
			// Update button
			if (this.modeToggleBtn) {
				this.modeToggleBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/>
          <line x1="21" y1="3" x2="12" y2="12"/>
          <path d="M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
        </svg>`;
				this.modeToggleBtn.title = "Pop out as floating window";
			}
		}
	},

	// ── Make the floating panel draggable by its header ──
	initWindowDrag() {
		const panel = this.popup;
		if (!panel) return;

		const header = panel.querySelector(".chat-header");
		if (!header) return;

		let dragStartX = 0,
			dragStartY = 0;
		let panelStartLeft = 0,
			panelStartTop = 0;
		let dragging = false;

		const onMouseMove = (e) => {
			if (!dragging) return;
			const dx = e.clientX - dragStartX;
			const dy = e.clientY - dragStartY;

			// Clamp within viewport
			const maxLeft = window.innerWidth - panel.offsetWidth - 8;
			const maxTop = window.innerHeight - panel.offsetHeight - 8;
			const newLeft = Math.max(8, Math.min(panelStartLeft + dx, maxLeft));
			const newTop = Math.max(8, Math.min(panelStartTop + dy, maxTop));

			panel.style.left = newLeft + "px";
			panel.style.top = newTop + "px";
		};

		const onMouseUp = () => {
			if (!dragging) return;
			dragging = false;
			header.classList.remove("header-dragging");
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};

		header.addEventListener("mousedown", (e) => {
			// Only drag in floating mode, and don't interfere with header buttons
			if (this.mode !== "floating") return;
			if (e.target.closest("button, span.close-chat")) return;

			e.preventDefault();
			dragging = true;
			dragStartX = e.clientX;
			dragStartY = e.clientY;
			panelStartLeft = panel.offsetLeft;
			panelStartTop = panel.offsetTop;

			header.classList.add("header-dragging");
			document.body.style.userSelect = "none";
			document.body.style.cursor = "grabbing";
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		});
	},

	// ── Floating-window: 8-direction resize ──
	initFloatResize() {
		const panel = this.popup;
		if (!panel) return;

		const css = getComputedStyle(document.documentElement);
		const minW = parseInt(css.getPropertyValue("--cb-min-width")) || 320;
		const maxW = parseInt(css.getPropertyValue("--cb-max-width")) || 700;
		const minH = 280;
		const maxH = () => window.innerHeight - 24;

		const clampW = (w) => Math.min(Math.max(w, minW), maxW);
		const clampH = (h) => Math.min(Math.max(h, minH), maxH());

		// dirs: object with boolean flags { n, s, e, w }
		const makeDragger = (id, dirs) => {
			const el = document.getElementById(id);
			if (!el) return;

			let sX, sY, sW, sH, sTop, sLeft;

			const onMove = (e) => {
				const dx = e.clientX - sX;
				const dy = e.clientY - sY;

				// North: drag up = taller, top moves up
				if (dirs.n) {
					const newH = clampH(sH - dy);
					panel.style.height = newH + "px";
					panel.style.top = sTop + sH - newH + "px";
				}
				// South: drag down = taller
				if (dirs.s) {
					panel.style.height = clampH(sH + dy) + "px";
				}
				// East: drag right = wider
				if (dirs.e) {
					const newW = clampW(sW + dx);
					panel.style.width = newW + "px";
					document.documentElement.style.setProperty("--cb-width", newW + "px");
				}
				// West: drag left = wider, left edge moves left
				if (dirs.w) {
					const newW = clampW(sW - dx);
					panel.style.width = newW + "px";
					panel.style.left = sLeft + sW - newW + "px";
					document.documentElement.style.setProperty("--cb-width", newW + "px");
				}
			};

			const onUp = () => {
				document.body.style.userSelect = "";
				document.body.style.cursor = "";
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
			};

			el.addEventListener("mousedown", (e) => {
				if (this.mode !== "floating") return;
				e.preventDefault();
				sX = e.clientX;
				sY = e.clientY;
				sW = panel.offsetWidth;
				sH = panel.offsetHeight;
				sTop = panel.offsetTop;
				sLeft = panel.offsetLeft;
				document.body.style.userSelect = "none";
				document.body.style.cursor = getComputedStyle(el).cursor;
				document.addEventListener("mousemove", onMove);
				document.addEventListener("mouseup", onUp);
			});
		};

		makeDragger("float-resize-n", { n: true });
		makeDragger("float-resize-s", { s: true });
		makeDragger("float-resize-e", { e: true });
		makeDragger("float-resize-w", { w: true });
		makeDragger("float-resize-nw", { n: true, w: true });
		makeDragger("float-resize-ne", { n: true, e: true });
		makeDragger("float-resize-se", { s: true, e: true });
		makeDragger("float-resize-sw", { s: true, w: true });
	},

	// ── Drag-to-resize the sidebar panel (left edge / width) ──
	initResize() {
		const handle = this.chatResizeHandle;
		const panel = this.popup;
		if (!handle || !panel) return;

		// Read CSS vars for min/max
		const style = getComputedStyle(document.documentElement);
		const minW = parseInt(style.getPropertyValue("--cb-min-width")) || 320;
		const maxW = parseInt(style.getPropertyValue("--cb-max-width")) || 700;

		let startX, startW;

		const onMouseMove = (e) => {
			// In pinned mode: panel is right-anchored → drag left = wider
			// In floating mode: panel is free → drag right = wider (natural feel)
			const dx =
				this.mode === "floating" ? e.clientX - startX : startX - e.clientX;
			const newW = Math.min(Math.max(startW + dx, minW), maxW);
			panel.style.width = newW + "px";
			document.documentElement.style.setProperty("--cb-width", newW + "px");
		};

		const onMouseUp = () => {
			handle.classList.remove("dragging");
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
		};

		handle.addEventListener("mousedown", (e) => {
			e.preventDefault();
			startX = e.clientX;
			startW = panel.offsetWidth;
			handle.classList.add("dragging");
			document.body.style.userSelect = "none";
			document.body.style.cursor = "ew-resize";
			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		});
	},

	// ── Append a plain text/html message bubble ──
	appendMessage(text, sender) {
		if (!this.messagesArea) return;

		const msgDiv = document.createElement("div");
		msgDiv.className = `message ${sender}`;
		// Support **bold** and *italic* markdown
		let formatted = text
			.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
			.replace(/\*(.*?)\*/g, "<em>$1</em>")
			.replace(/\n/g, "<br>");
		msgDiv.innerHTML = formatted;

		this.messagesArea.appendChild(msgDiv);
		this.scrollToBottom();
	},

	// ── Append symptom tags ──
	appendSymptomTags(symptoms) {
		if (!this.messagesArea) return;

		const container = document.createElement("div");
		container.className = "message bot symptom-tags-container";

		const label = document.createElement("span");
		label.className = "symptom-label";
		label.textContent = "✅ Detected symptoms:";
		container.appendChild(label);

		const tagsWrap = document.createElement("div");
		tagsWrap.className = "symptom-tags";
		symptoms.forEach((s) => {
			const tag = document.createElement("span");
			tag.className = "symptom-tag";
			tag.textContent = s.replace(/_/g, " ");
			tagsWrap.appendChild(tag);
		});
		container.appendChild(tagsWrap);

		this.messagesArea.appendChild(container);
		this.scrollToBottom();
	},

	// ── Append follow-up question with Yes/No buttons ──
	appendFollowUp(followUp) {
		if (!this.messagesArea) return;

		const wrap = document.createElement("div");
		wrap.className = "message bot followup-message";

		// Progress indicator
		const progress = document.createElement("div");
		progress.className = "followup-progress";
		progress.textContent = `Question ${followUp.index + 1} of ${followUp.total}`;
		wrap.appendChild(progress);

		// Question text
		const question = document.createElement("div");
		question.className = "followup-question";
		question.innerHTML = followUp.question.replace(
			/\*\*(.*?)\*\*/g,
			"<strong>$1</strong>",
		);
		wrap.appendChild(question);

		// Quick reply buttons
		const btns = document.createElement("div");
		btns.className = "quick-reply-buttons";

		const yesBtn = document.createElement("button");
		yesBtn.className = "quick-reply-btn yes";
		yesBtn.textContent = "Yes";
		yesBtn.onclick = () => this._handleQuickReply("yes", btns);

		const noBtn = document.createElement("button");
		noBtn.className = "quick-reply-btn no";
		noBtn.textContent = "No";
		noBtn.onclick = () => this._handleQuickReply("no", btns);

		btns.appendChild(yesBtn);
		btns.appendChild(noBtn);
		wrap.appendChild(btns);

		this.messagesArea.appendChild(wrap);
		this.scrollToBottom();
	},

	_handleQuickReply(answer, btnContainer) {
		// Disable buttons after click
		btnContainer.querySelectorAll("button").forEach((b) => {
			b.disabled = true;
			b.classList.add("disabled");
		});
		// Highlight selected
		const selected = btnContainer.querySelector(
			answer === "yes" ? ".yes" : ".no",
		);
		if (selected) selected.classList.add("selected");

		// Show user answer as a bubble
		this.appendMessage(answer === "yes" ? "Yes" : "No", "user");

		// Send to backend
		this._sendToBackend(answer);
	},

	// ── Append the final result card ──
	appendResultCard(result) {
		if (!this.messagesArea) return;

		const card = document.createElement("div");
		card.className = "message bot result-card";

		card.innerHTML = `
      <div class="result-header">
        <span class="result-icon">🩺</span>
        <span class="result-title">Diagnosis Result</span>
      </div>

      <div class="result-disease">
        <h3>${result.disease}</h3>
        <div class="confidence-bar-container">
          <div class="confidence-bar" style="width: 0%"></div>
        </div>
        <span class="confidence-text">${result.confidence}% confidence</span>
      </div>

      <div class="result-symptoms-used">
        <span class="result-section-label">📋 Symptoms analysed:</span>
        <div class="symptom-tags">
          ${result.symptoms_used
						.map((s) => `<span class="symptom-tag">${s}</span>`)
						.join("")}
        </div>
      </div>

      <div class="result-description">
        <span class="result-section-label">📖 About this condition:</span>
        <p>${result.description}</p>
      </div>

      ${
				result.precautions && result.precautions.length
					? `<div class="result-precautions">
              <span class="result-section-label">🛡️ Recommended precautions:</span>
              <ol>
                ${result.precautions
									.filter((p) => p && p.trim())
									.map((p) => `<li>${p}</li>`)
									.join("")}
              </ol>
            </div>`
					: ""
			}

      <div class="result-quote">${result.quote}</div>

      <div class="result-disclaimer">
        ⚠️ This is an AI-based suggestion. Please consult a healthcare professional for proper diagnosis.
      </div>

      <button class="new-consultation-btn" onclick="Chatbot.resetChat()">
        🔄 Start New Consultation
      </button>
    `;

		this.messagesArea.appendChild(card);
		// Force layout reflow
		void card.offsetHeight;
		this.scrollToBottom();

		// Scroll the new card into view
		setTimeout(() => {
			card.scrollIntoView({ behavior: "smooth", block: "end" });
		}, 50);

		// Animate confidence bar
		requestAnimationFrame(() => {
			setTimeout(() => {
				const bar = card.querySelector(".confidence-bar");
				if (bar) bar.style.width = result.confidence + "%";
				this.scrollToBottom();
				card.scrollIntoView({ behavior: "smooth", block: "end" });
			}, 150);
		});
	},

	// ── Show / hide typing indicator ──
	showTyping(show) {
		if (this.typingIndicator) {
			this.typingIndicator.style.display = show ? "flex" : "none";
			this.scrollToBottom();
		}
	},

	scrollToBottom() {
		if (this.messagesArea) {
			this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
		}
	},

	// ── Public: send user-typed message ──
	sendMessage() {
		const message = this.input.value.trim();
		if (!message) return;
		this.input.value = "";
		this.appendMessage(message, "user");
		this._sendToBackend(message);
	},

	// ── Core: send any message to backend ──
	_sendToBackend(message) {
		this.showTyping(true);

		// Disable input during processing
		if (this.input) this.input.disabled = true;
		if (this.sendBtn) this.sendBtn.disabled = true;

		// Disable any active quick reply buttons in the messages area
		if (this.messagesArea) {
			this.messagesArea.querySelectorAll(".quick-reply-btn").forEach((b) => {
				b.disabled = true;
				b.classList.add("disabled");
			});
		}

		fetch(this.getBackendUrl(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: message,
				session_id: this.sessionId,
			}),
		})
			.then((res) => {
				if (!res.ok) throw new Error("Server error " + res.status);
				return res.json();
			})
			.then((data) => {
				console.log("CHATBOT API RESPONSE:", data);
				this.showTyping(false);
				this._enableInput();

				if (!data.success) {
					this.appendMessage(
						data.response ||
							"I'm sorry, something went wrong. Please try again.",
						"bot",
					);
					this._setInputVisible(true);
					return;
				}

				// Handle response text (if any)
				if (data.response) {
					this.appendMessage(data.response, "bot");
				}

				// Handle final result (check this BEFORE follow_up so visibility is set correctly)
				if (data.result) {
					// Always append a simple textual summary first as a fallback
					try {
						const r = data.result || {};
						const disease = r.disease || "Diagnosis";
						const confidence =
							r.confidence !== undefined && r.confidence !== null
								? r.confidence
								: "";
						const desc = r.description || "";
						const summary =
							confidence !== ""
								? `${disease} — ${confidence}% confidence\n\n${desc}`
								: `${disease}\n\n${desc}`;
						this.appendMessage(summary, "bot");
					} catch (e) {
						console.error("Failed to append textual summary:", e);
					}

					try {
						this.appendResultCard(data.result);
					} catch (e) {
						console.error("Error rendering result card:", e);
						this.appendMessage(
							"⚠️ Could not render the diagnosis card. Please try again.",
							"bot",
						);
					}

					// Hide the text box after the final diagnosis is shown.
					this._setInputVisible(false);
					this._enableInput();
					try {
						if (this.input) {
							this.input.focus();
							this.input.selectionStart = this.input.selectionEnd = this.input
								.value
								? this.input.value.length
								: 0;
						}
					} catch (e) {
						// ignore
					}

					setTimeout(() => {
						this.scrollToBottom();
						const lastCard = this.messagesArea.querySelector(".result-card");
						if (lastCard) {
							lastCard.scrollIntoView({ behavior: "smooth", block: "end" });
						}
					}, 150);
					return;
				}

				// Handle follow-up question
				if (data.follow_up) {
					this.appendFollowUp(data.follow_up);
				}
				this._setInputVisible(true);
			})
			.catch((err) => {
				this.showTyping(false);
				this._enableInput();
				console.error("Chatbot communication error:", err);
				this.appendMessage(
					"⚠️ Could not connect to the AI server. Please make sure the chatbot server is running on port 5050.",
					"bot",
				);
			});
	},

	_enableInput() {
		if (this.input) {
			this.input.disabled = false;
			try {
				this.input.focus();
				// place caret at end if supported
				this.input.selectionStart = this.input.selectionEnd = this.input.value
					? this.input.value.length
					: 0;
			} catch (e) {
				// ignore focus errors in non-DOM environments
			}
		}
		if (this.sendBtn) this.sendBtn.disabled = false;
	},

	_setInputVisible(visible) {
		const inputArea = document.querySelector(".chat-input-area");
		if (inputArea) {
			inputArea.style.display = visible ? "flex" : "none";
		}
	},

	// ── Reset chat for new consultation ──
	async resetChat() {
		// Generate a new session ID for the new conversation
		this.sessionId = "session_" + Math.random().toString(36).substr(2, 9);
		localStorage.setItem("smartcare_chat_session", this.sessionId);

		// Clear messages
		if (this.messagesArea) {
			this.messagesArea.innerHTML = "";
		}

		// Show input
		this._setInputVisible(true);
		this._enableInput();

		try {
			const res = await fetch(this.getBackendUrl(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: "reset",
					session_id: this.sessionId,
				}),
			});
			const data = await res.json();
			if (data.response) {
				this.appendMessage(data.response, "bot");
			}
			if (data.follow_up) {
				this.appendFollowUp(data.follow_up);
			}
		} catch (err) {
			console.warn("Background session reset failed:", err);
			this.showWelcomeMessage();
		}
	},

	// ── History API Integration ──
	async fetchHistory() {
		const listEl = document.getElementById("history-list");
		if (!listEl) return;

		listEl.innerHTML = `<div style="padding: 15px; color: var(--cb-neutral-text); font-size: 0.85rem;">Loading history...</div>`;

		try {
			const res = await fetch(this.getHistoryUrl(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ session_id: this.sessionId }),
			});
			const data = await res.json();

			if (!data.success || !data.sessions || data.sessions.length === 0) {
				listEl.innerHTML = `<div style="padding: 15px; color: var(--cb-neutral-text); font-size: 0.85rem;">No previous sessions found.</div>`;
				return;
			}

			listEl.innerHTML = "";
			data.sessions.forEach((session) => {
				const item = document.createElement("div");
				item.className = "history-item";
				if (session.session_id === this.sessionId) item.classList.add("active");

				const dateStr = new Date(session.last_updated).toLocaleString(
					undefined,
					{
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					},
				);

				const rawTitle = session.title || "Untitled Session";
				const formattedTitle = this.formatSessionTitle(rawTitle);

				item.innerHTML = `
          <div class="history-item-info">
            <div class="history-title" title="${formattedTitle}">${formattedTitle}</div>
            <div class="history-date">${dateStr}</div>
          </div>
          <button class="delete-session-btn" title="Delete Session">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;

				const deleteBtn = item.querySelector(".delete-session-btn");
				deleteBtn.onclick = async (e) => {
					e.stopPropagation();
					const confirmed = await this.showConfirmModal();
					if (confirmed) {
						try {
							const deleteUrl = this.getHistoryUrl().replace(
								"get_chat_history.php",
								"delete_chat_session.php",
							);
							await fetch(deleteUrl, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ session_id: session.session_id }),
							});
							this.fetchHistory();
							// If deleting the current active session, reset the chat
							if (this.sessionId === session.session_id) {
								this.resetChat();
							}
						} catch (err) {
							console.error("Failed to delete session", err);
						}
					}
				};

				item.onclick = () => {
					this.loadSession(session.session_id);
					this.popup.classList.remove("history-open");
				};
				listEl.appendChild(item);
			});
		} catch (err) {
			console.error("Failed to load history:", err);
			listEl.innerHTML = `<div style="padding: 15px; color: red; font-size: 0.85rem;">Failed to load history.</div>`;
		}
	},

	showConfirmModal() {
		return new Promise((resolve) => {
			const modal = document.getElementById("cb-delete-modal");
			if (!modal) return resolve(true); // Fallback if HTML is missing

			modal.classList.add("visible");

			const confirmBtn = document.getElementById("cb-confirm-delete");
			const cancelBtn = document.getElementById("cb-cancel-delete");

			const cleanup = () => {
				modal.classList.remove("visible");
				confirmBtn.onclick = null;
				cancelBtn.onclick = null;
			};

			confirmBtn.onclick = () => {
				cleanup();
				resolve(true);
			};
			cancelBtn.onclick = () => {
				cleanup();
				resolve(false);
			};
		});
	},

	async loadSession(session_id) {
		if (this.sessionId === session_id) return;

		this.sessionId = session_id;
		localStorage.setItem("smartcare_chat_session", this.sessionId);

		if (this.messagesArea) {
			this.messagesArea.innerHTML = "";
		}

		this.showTyping(true);

		try {
			const res = await fetch(this.getHistoryUrl(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fetch_session: session_id }),
			});
			const data = await res.json();
			this.showTyping(false);

			if (data.success && data.messages) {
				data.messages.forEach((msg) => {
					// Wrap bot messages if not already wrapped
					let text = msg.message;
					if (msg.sender === "bot" && !text.includes("<img")) {
						const isInHtmlFolder = window.location.pathname.includes("/HTML/");
						const basePath = isInHtmlFolder ? "../" : "./";
						text =
							`<img src="${basePath}Assets/Icons/blue-chatbot.svg" alt="AI" style="width: 18px; height: 18px; vertical-align: bottom; margin-right: 6px;"> ` +
							text;
					}
					this.appendMessage(text, msg.sender);
				});
			} else {
				this.showWelcomeMessage();
			}

			this._setInputVisible(true);
			this._enableInput();
		} catch (err) {
			this.showTyping(false);
			console.error("Failed to load session messages:", err);
			this.appendMessage("⚠️ Failed to load previous messages.", "bot");
		}
	},
};

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
	Chatbot.init();
});
