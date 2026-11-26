(() => {
  if (window.__revHubQuestionEditorLoaded) return;
  window.__revHubQuestionEditorLoaded = true;

  const $ = id => document.getElementById(id);

  const style = document.createElement('style');
  style.textContent = `
    #rhQuestionEditor { position:fixed; inset:0; z-index:10002; display:grid; place-items:center; overflow-y:auto; padding:16px; background:rgba(5,9,18,.78); backdrop-filter:blur(8px); }
    #rhQuestionEditor .rh-editor-card { width:min(620px,100%); max-height:calc(100dvh - 32px); overflow-y:auto; padding:22px; border:1px solid rgba(255,255,255,.55); border-radius:20px; background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(236,244,255,.94)); color:#111827; box-shadow:0 24px 80px rgba(0,0,0,.38); }
    #rhQuestionEditor h2 { margin:0 0 8px; }
    #rhQuestionEditor label { display:block; margin-top:13px; color:#374151; font-weight:650; }
    #rhQuestionEditor textarea,#rhQuestionEditor input { width:100%; margin-top:7px; padding:11px 12px; border:1px solid rgba(31,41,55,.22); border-radius:11px; background:rgba(255,255,255,.92); color:#111827; font:inherit; }
    #rhOptionOrder { display:grid; gap:7px; margin-top:8px; }
    #rhOptionOrder .rh-option-row { display:grid; grid-template-columns:34px 1fr auto auto; gap:6px; align-items:center; padding:7px; border:1px solid rgba(31,41,55,.13); border-radius:10px; background:rgba(255,255,255,.82); }
    #rhOptionOrder input { margin:0; }
    #rhOptionOrder button { min-width:34px; padding:8px; }
    #rhQuestionEditor .rh-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
    #rhSolutionReveal { display:none; margin-top:12px; padding:12px; border-left:4px solid #22c55e; border-radius:10px; background:rgba(34,197,94,.10); color:#111827; white-space:pre-wrap; }
  `;
  document.head.appendChild(style);

  function openQuestionEditor(question) {
    $('rhQuestionEditor')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'rhQuestionEditor';
    dialog.innerHTML = `<section class="rh-editor-card" role="dialog" aria-modal="true"><h2>Edit screenshot question</h2><label>Question<textarea id="rhEditQuestion" rows="4"></textarea></label><label>Answer options and order <span class="muted small">Use arrows to rearrange; select the correct option.</span></label><div id="rhOptionOrder"></div><label>Solution<textarea id="rhEditSolution" rows="5"></textarea></label><div class="rh-actions"><button type="button" class="secondary" id="rhCancelEdit">Cancel</button><button type="button" id="rhSaveEdit">Save changes</button></div></section>`;
    document.body.appendChild(dialog);
    $('rhEditQuestion').value = question.text || '';
    $('rhEditSolution').value = question.solution || '';

    let options = [...(question.options || [])];
    let correctIndex = options.findIndex(option => option === question.answer);

    function renderOptions() {
      const container = $('rhOptionOrder');
      container.innerHTML = '';
      options.forEach((option, index) => {
        const row = document.createElement('div');
        row.className = 'rh-option-row';
        row.innerHTML = `<input type="radio" name="rhCorrectOption" ${index === correctIndex ? 'checked' : ''} aria-label="Correct option"><input type="text" value="${String(option).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;")}" aria-label="Option ${index + 1}"><button type="button" class="secondary" data-direction="up" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" class="secondary" data-direction="down" ${index === options.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>`;
        const textInput = row.querySelectorAll('input[type=text]')[0];
        textInput.addEventListener('input', () => { options[index] = textInput.value; });
        row.querySelector('input[type=radio]').addEventListener('change', () => { correctIndex = index; });
        row.querySelector('[data-direction=up]').addEventListener('click', () => {
          if (index === 0) return;
          const correctWasAt = correctIndex === index;
          const correctWasBelow = correctIndex === index - 1;
          [options[index - 1], options[index]] = [options[index], options[index - 1]];
          if (correctWasAt) correctIndex = index - 1;
          else if (correctWasBelow) correctIndex = index;
          renderOptions();
        });
        row.querySelector('[data-direction=down]').addEventListener('click', () => {
          if (index === options.length - 1) return;
          const correctWasAt = correctIndex === index;
          const correctWasBelow = correctIndex === index + 1;
          [options[index], options[index + 1]] = [options[index + 1], options[index]];
          if (correctWasAt) correctIndex = index + 1;
          else if (correctWasBelow) correctIndex = index;
          renderOptions();
        });
        container.appendChild(row);
      });
    }
    renderOptions();

    $('rhCancelEdit').onclick = () => dialog.remove();
    $('rhSaveEdit').onclick = () => {
      const text = $('rhEditQuestion').value.trim();
      const solution = $('rhEditSolution').value.trim();
      const editedOptions = Array.from(dialog.querySelectorAll('#rhOptionOrder input[type=text]')).map(input => input.value.trim()).filter(Boolean);
      if (!text) { toast('The question cannot be empty.'); return; }
      if (editedOptions.length < 2) { toast('A question needs at least two options.'); return; }
      if (correctIndex < 0 || correctIndex >= editedOptions.length) { toast('Select the correct option.'); return; }
      question.text = text;
      question.options = editedOptions;
      question.answer = editedOptions[correctIndex];
      question.solution = solution;
      save();
      renderPractice();
      renderLibrary();
      dialog.remove();
      toast('Question, option order and solution updated.');
    };
  }

  const originalRenderPractice = renderPractice;
  renderPractice = function () {
    originalRenderPractice();
    const arr = filteredQuestions();
    const question = arr[practiceIndex];
    if (!question) return;

    const card = $('practiceCard');
    let editButton = $('rhEditQuestionButton');
    if (!editButton) {
      editButton = document.createElement('button');
      editButton.id = 'rhEditQuestionButton';
      editButton.className = 'secondary';
      editButton.textContent = 'Edit question / option order';
      card.insertAdjacentElement('afterend', editButton);
    }
    editButton.onclick = () => openQuestionEditor(question);

    card.querySelectorAll('input[name="practiceChoice"], [data-choice]').forEach(control => {
      control.addEventListener('change', revealSolution);
      if (control.tagName === 'BUTTON') control.addEventListener('click', () => setTimeout(revealSolution, 0));
    });

    function revealSolution() {
      if (!question.solution) return;
      let solution = $('rhSolutionReveal');
      if (!solution) {
        solution = document.createElement('div');
        solution.id = 'rhSolutionReveal';
        card.appendChild(solution);
      }
      solution.style.display = 'block';
      solution.textContent = `Solution: ${question.solution}`;
    }
  };

  try { renderPractice(); } catch (_) { /* app data may still be initializing */ }
})();
