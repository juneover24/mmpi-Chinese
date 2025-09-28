// Append text to the DOM
function append_text(txt) {
  var docbody = document.getElementsByTagName("body")[0];
  docbody.appendChild(document.createTextNode(txt));
  docbody.appendChild(document.createElement("br"));
}

// Append row data to a row
function append_td(row, txt) {
  var tdata = document.createElement("td");
  tdata.appendChild(document.createTextNode(txt));
  row.appendChild(tdata);
}

// Append a row of data to a table
function append_tr(table) {
  var trow = document.createElement("tr");
  for (var i = 1; i < arguments.length; ++i) {
    append_td(trow, arguments[i]);
  }
  table.appendChild(trow);
}

// Append a table to the DOM and return a reference to it
// Arguments are table headings (variable length)
function make_table() {
  var docbody, table, thead, tbody, trow, i;

  docbody = document.getElementsByTagName("body")[0];
  table = document.createElement("table");
  table.setAttribute("border", "5");
  thead = document.createElement("thead");
  table.appendChild(thead);
  tbody = document.createElement("tbody");
  table.appendChild(tbody);
  docbody.appendChild(table);

  trow = document.createElement("tr");
  for (i = 0; i < arguments.length; ++i) {
    append_td(trow, arguments[i]);
  }
  thead.appendChild(trow);

  return tbody;
}

longform = true; // All questions or first 370
gender = 0; // 0==male, 1==female
age = null; // User's age
ans = []; // Answers to questions: [T,F,?]
re_scale_only = false; // 是否只测试RE量表

// 将结果文本添加到指定元素 - 优化：使用文档片段减少重绘
function append_result_text(txt, targetElement) {
  var resultsContent = targetElement || document.getElementById('results-content');
  if (!resultsContent) return;
  
  var p = document.createElement('p');
  p.textContent = txt;
  resultsContent.appendChild(p);
}

// 创建结果表格 - 优化：使用文档片段减少DOM操作
function make_result_table() {
  var resultsContent = document.getElementById('results-content');
  if (!resultsContent) return null;
  
  var fragment = document.createDocumentFragment();
  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var tbody = document.createElement('tbody');
  var headerRow = document.createElement('tr');
  
  table.appendChild(thead);
  table.appendChild(tbody);
  thead.appendChild(headerRow);
  
  // 添加表头
  for (var i = 0; i < arguments.length; ++i) {
    var th = document.createElement('th');
    th.textContent = arguments[i];
    headerRow.appendChild(th);
  }
  
  fragment.appendChild(table);
  resultsContent.appendChild(fragment);
  return tbody;
}

// 添加行到表格 - 优化：使用文档片段
function append_result_tr(table) {
  if (!table) return;
  
  var trow = document.createElement('tr');
  for (var i = 1; i < arguments.length; ++i) {
    var td = document.createElement('td');
    td.textContent = arguments[i];
    trow.appendChild(td);
  }
  table.appendChild(trow);
}

// 分页相关变量
var currentPage = 1;
var questionsPerPage = 10;
var totalPages = 1;
var cachedDomElements = {}; // 缓存频繁访问的DOM元素

// 缓存频繁访问的DOM元素
function cacheDomElements() {
  cachedDomElements = {
    questionsContent: document.getElementById('questions-content'),
    resultsContent: document.getElementById('results-content'),
    resultsContainer: document.getElementById('results-container'),
    questionsContainer: document.getElementById('questions-container'),
    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    paginationControls: document.getElementById('pagination-controls'),
    submitButton: document.getElementById('submit-button'),
    submitPrompt: document.getElementById('submit-prompt')
  };
  
  return cachedDomElements;
}

// 优化：使用事件委托而不是为每个radio绑定事件
function setupEventDelegation() {
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  if (!questionsContent) return;
  
  console.log("设置事件委托...");
  
  // 使用事件委托处理所有单选按钮的点击
  questionsContent.addEventListener('change', function(e) {
    if (e.target && e.target.type === 'radio') {
      // 移除当前问题组中所有选项的active类
      var optionsContainer = e.target.closest('.options-container');
      if (optionsContainer) {
        var labels = optionsContainer.querySelectorAll('.option-label');
        for (var j = 0; j < labels.length; j++) {
          labels[j].classList.remove('active');
        }
        
        // 给当前选中选项添加active类
        e.target.closest('.option-label').classList.add('active');
        
        // 更新ans数组
        var questionNumber = parseInt(e.target.name, 10);
        var answerValue = e.target.value;
        
        console.log("用户回答：题号 " + questionNumber + " = " + answerValue);
        
        // 确保ans数组有足够大小
        while(ans.length <= questionNumber) {
          ans.push(undefined);
        }
        ans[questionNumber] = answerValue;
        
        // 处理自动滚动
        handleAutoScroll(e.target);
        
        // 更新进度条和提交按钮状态
        updateProgressBar();
        updateSubmitButtonState();
      }
    }
  });
}

// 处理自动滚动逻辑
function handleAutoScroll(radioButton) {
  // 找到当前问题
  var currentQuestion = radioButton.closest('.question-item, .re-question');
  if (!currentQuestion) return;
  
  // 获取所有可见问题
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  var visibleQuestions = Array.from(
    questionsContent.querySelectorAll('.question-item:not([style*="display: none"]), .re-question:not([style*="display: none"])')
  ).sort(function(a, b) {
    var idA = parseInt(a.id.substring(1), 10);
    var idB = parseInt(b.id.substring(1), 10);
    return idA - idB;
  });
  
  console.log("可见问题数量：", visibleQuestions.length);
  
  // 找到当前问题在可见问题中的索引
  var currentIndex = visibleQuestions.indexOf(currentQuestion);
  if (currentIndex === -1) return;
  
  console.log("当前问题索引：", currentIndex);
  
  // 获取下一个问题
  var nextQuestion = currentIndex < visibleQuestions.length - 1 ? visibleQuestions[currentIndex + 1] : null;
  
  // 如果存在下一个问题，滚动到它
  if (nextQuestion) {
    setTimeout(function() {
      console.log("滚动到下一个问题：", nextQuestion.id);
      nextQuestion.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 300);
      } else {
    // 如果是当前页的最后一个问题，检查是否要自动翻页
      if (currentPage < totalPages) {
        setTimeout(function() {
        console.log("已到达当前页最后一个问题，准备翻页");
          var nextButton = document.querySelector('.next-button');
        if (nextButton && !nextButton.disabled) {
          console.log("自动翻到下一页");
          nextButton.click();
        }
        }, 500);
    } else {
      console.log("已到达最后一页的最后一个问题");
    }
  }
}

// 修改doc_write_all_questions函数，改为只准备题目数据而不立即显示所有题目
function doc_write_all_questions() {
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  if (!questionsContent) {
    console.error('找不到问题容器元素');
    return;
  }
  
  // 清空问题容器
  questionsContent.innerHTML = '';
  
  // 准备问题数据
  window.allQuestions = [];
  
  // 准备进度指示器
  var progressContainer = document.createElement('div');
  progressContainer.className = 'question-progress-container';
  
  var progressBar = document.createElement('div');
  progressBar.id = 'question-progress-bar';
  progressBar.className = 'question-progress-bar';
  
  var progressText = document.createElement('div');
  progressText.id = 'question-progress-text';
  progressText.className = 'question-progress-text';
  progressText.textContent = '题目: 0 / 0';
  
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);
  questionsContent.appendChild(progressContainer);
  
  // 创建问题容器
  var singleQuestionContainer = document.createElement('div');
  singleQuestionContainer.id = 'single-question-container';
  singleQuestionContainer.className = 'single-question-container';
  questionsContent.appendChild(singleQuestionContainer);
  
  // 创建导航按钮
  var navButtons = document.createElement('div');
  navButtons.className = 'question-navigation';
  
  var prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.id = 'prev-question';
  prevButton.className = 'prev-question-btn';
  prevButton.textContent = '上一题';
  prevButton.onclick = function() { navigateQuestion(-1); };
  
  var nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.id = 'next-question';
  nextButton.className = 'next-question-btn';
  nextButton.textContent = '跳过';
  nextButton.onclick = function() { navigateQuestion(1); };
  
  var submitButton = document.createElement('button');
  submitButton.type = 'button';
  submitButton.id = 'submit-test';
  submitButton.className = 'submit-button';
  submitButton.textContent = '提交测试';
  submitButton.style.display = 'none';
  submitButton.onclick = function() { confirmSubmitTest(); };
  
  navButtons.appendChild(prevButton);
  navButtons.appendChild(nextButton);
  navButtons.appendChild(submitButton);
  questionsContent.appendChild(navButtons);
  
  // 收集所有问题
  var n = longform ? questions.length : 371;
  
  // 如果是只测试RE量表
  if (re_scale_only) {
    // 查找RE量表的索引
    var re_index = findReScale();
    
    if (re_index !== -1) {
      console.log("加载RE量表题目，索引为：", re_index);
      
      // 收集RE量表的所有问题
      var re_questions = [];
      
      // 收集True问题
      for (var j = 0; j < scales[re_index][1].length; ++j) {
        var q = scales[re_index][1][j];
        if (questions[q]) {
        re_questions.push({
          num: q,
            text: questions[q],
            is_true_question: true
        });
          console.log("添加True题目：", q, questions[q]);
        } else {
          console.error("找不到题目文本：", q);
        }
      }
      
      // 收集False问题
      for (var j = 0; j < scales[re_index][2].length; ++j) {
        var q = scales[re_index][2][j];
        if (questions[q]) {
        re_questions.push({
          num: q,
            text: questions[q],
            is_true_question: false
        });
          console.log("添加False题目：", q, questions[q]);
        } else {
          console.error("找不到题目文本：", q);
        }
      }
      
      // 按照原始题号排序
      re_questions.sort(function(a, b) {
        return a.num - b.num;
      });
      
      console.log("排序后的RE量表题目：", re_questions.map(function(q) { return q.num; }).join(', '));
      
      // 准备RE量表问题
      for (var j = 0; j < re_questions.length; ++j) {
        window.allQuestions.push({
          id: re_questions[j].num,
          text: (j + 1) + ". " + re_questions[j].text,
          isReQuestion: true
        });
      }
    } else {
      console.error("无法找到RE量表索引");
      var errorMsg = document.createElement('p');
      errorMsg.textContent = "错误：无法找到社会责任感量表数据，请刷新页面重试。";
      errorMsg.style.color = "red";
      singleQuestionContainer.appendChild(errorMsg);
      return;
    }
  } else {
    // 收集普通问题
    for (var i = 1; i < n; ++i) {
      if (questions[i]) {
        window.allQuestions.push({
          id: i,
          text: i + ". " + questions[i],
          isReQuestion: false
        });
      } else {
        console.error("找不到题目文本：", i);
      }
    }
  }
  
  // 设置当前题目索引
  window.currentQuestionIndex = 0;
  
  // 显示第一道题目
  showCurrentQuestion();
  
  // 设置事件委托
  setupSingleQuestionEventDelegation();
}

// 显示当前题目
function showCurrentQuestion() {
  var container = document.getElementById('single-question-container');
  if (!container) return;
  
  // 清空容器
  container.innerHTML = '';
  
  // 如果没有题目数据，显示错误信息
  if (!window.allQuestions || window.allQuestions.length === 0) {
    var errorMsg = document.createElement('p');
    errorMsg.textContent = "错误：未找到题目数据，请刷新页面重试。";
    errorMsg.style.color = "red";
    container.appendChild(errorMsg);
    return;
  }
  
  // 获取当前题目数据
  var questionData = window.allQuestions[window.currentQuestionIndex];
  
  // 创建题目元素
  var questionElement = document.createElement('div');
  questionElement.className = questionData.isReQuestion ? 're-question' : 'question-item';
  questionElement.id = 'q' + questionData.id;
  
  // 添加题目文本
  var questionText = document.createElement('div');
  questionText.className = 'question-text';
  questionText.textContent = questionData.text;
  questionElement.appendChild(questionText);
  
  // 创建选项容器
  var optionsContainer = document.createElement('div');
  optionsContainer.className = 'options-container';
  
  // 创建选项
  var options = [
    { value: 'T', text: '是', className: 'true-option' },
    { value: 'F', text: '否', className: 'false-option' },
    { value: '?', text: '无法确定', className: 'uncertain-option' }
  ];
  
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var label = document.createElement('label');
    label.className = 'option-label ' + option.className;
    
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = questionData.id;
    input.value = option.value;
    input.className = 'option-input';
    
    // 如果已经有答案，选中对应选项
    if (ans[questionData.id] === option.value) {
      input.checked = true;
      label.classList.add('active');
    }
    
    var span = document.createElement('span');
    span.className = 'option-text';
    span.textContent = option.text;
    
    label.appendChild(input);
    label.appendChild(span);
    optionsContainer.appendChild(label);
  }
  
  questionElement.appendChild(optionsContainer);
  container.appendChild(questionElement);
  
  // 更新导航按钮状态
  updateQuestionNavigation();
  
  // 更新进度条
  updateQuestionProgress();
}

// 更新问题导航按钮状态
function updateQuestionNavigation() {
  var prevButton = document.getElementById('prev-question');
  var nextButton = document.getElementById('next-question');
  var submitButton = document.getElementById('submit-test');
  
  if (!prevButton || !nextButton || !submitButton) return;
  
  // 上一题按钮
  prevButton.disabled = window.currentQuestionIndex === 0;
  
  // 下一题按钮
  var isLastQuestion = window.currentQuestionIndex === window.allQuestions.length - 1;
  nextButton.textContent = isLastQuestion ? '跳过并完成' : '跳过';
  
  // 提交按钮
  submitButton.style.display = isLastQuestion ? 'inline-block' : 'none';
  
  // 检查是否所有题目都已回答
  var allAnswered = true;
  for (var i = 0; i < window.allQuestions.length; i++) {
    var qId = window.allQuestions[i].id;
    if (!ans[qId] || ans[qId] === '?') {
      allAnswered = false;
      break;
    }
  }
  
  submitButton.disabled = !allAnswered;
  submitButton.className = allAnswered ? 'submit-button ready' : 'submit-button';
}

// 更新问题进度
function updateQuestionProgress() {
  var progressBar = document.getElementById('question-progress-bar');
  var progressText = document.getElementById('question-progress-text');
  
  if (!progressBar || !progressText || !window.allQuestions) return;
  
  var total = window.allQuestions.length;
  var current = window.currentQuestionIndex + 1;
  var percentage = (current / total) * 100;
  
  progressBar.style.width = percentage + '%';
  progressText.textContent = '题目: ' + current + ' / ' + total + ' (' + Math.round(percentage) + '%)';
  
  // 计算已回答的题目数
  var answeredCount = 0;
  for (var i = 0; i < window.allQuestions.length; i++) {
    var qId = window.allQuestions[i].id;
    if (ans[qId] && ans[qId] !== '?') {
      answeredCount++;
    }
  }
  
  var answeredPercentage = (answeredCount / total) * 100;
  var completionText = ' - 已回答: ' + answeredCount + ' (' + Math.round(answeredPercentage) + '%)';
  progressText.textContent += completionText;
}

// 导航到上一题或下一题
function navigateQuestion(direction) {
  var newIndex = window.currentQuestionIndex + direction;
  
  // 边界检查
  if (newIndex < 0 || newIndex >= window.allQuestions.length) return;
  
  // 更新当前题目索引
  window.currentQuestionIndex = newIndex;
  
  // 显示新的题目
  showCurrentQuestion();
  
  // 滚动到顶部
  var container = document.getElementById('single-question-container');
  if (container) {
    container.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}

// 为单题模式设置事件委托
function setupSingleQuestionEventDelegation() {
  var container = document.getElementById('single-question-container');
  if (!container) return;
  
  console.log("设置单题模式事件委托...");
  
  // 监听选项点击
  container.addEventListener('change', function(e) {
    if (e.target && e.target.type === 'radio') {
      // 移除当前问题组中所有选项的active类
      var optionsContainer = e.target.closest('.options-container');
      if (optionsContainer) {
        var labels = optionsContainer.querySelectorAll('.option-label');
        for (var j = 0; j < labels.length; j++) {
          labels[j].classList.remove('active');
        }
        
        // 给当前选中选项添加active类
        e.target.closest('.option-label').classList.add('active');
        
        // 更新ans数组
        var questionNumber = parseInt(e.target.name, 10);
        var answerValue = e.target.value;
        
        console.log("用户回答：题号 " + questionNumber + " = " + answerValue);
        
        // 确保ans数组有足够大小
        while(ans.length <= questionNumber) {
          ans.push(undefined);
        }
        ans[questionNumber] = answerValue;
        
        // 更新导航按钮状态
        updateQuestionNavigation();
        
        // 更新进度
        updateQuestionProgress();
        
        // 如果不是最后一题，自动前进到下一题
        if (window.currentQuestionIndex < window.allQuestions.length - 1) {
          setTimeout(function() {
            navigateQuestion(1);
          }, 300);
        }
      }
    }
  });
}

// 确认提交测试
function confirmSubmitTest() {
  // 检查是否所有题目都已回答
  var unansweredCount = 0;
  for (var i = 0; i < window.allQuestions.length; i++) {
    var qId = window.allQuestions[i].id;
    if (!ans[qId] || ans[qId] === '?') {
      unansweredCount++;
    }
  }
  
  var message;
  if (unansweredCount > 0) {
    message = '您还有 ' + unansweredCount + ' 个问题未完成。确定要提交测试吗？';
  } else {
    message = '确定要提交测试并查看结果吗？';
  }
  
  if (confirm(message)) {
    score_rb(document.forms.questions);
  }
}

// 重新加载问题
function reloadQuestions() {
  // 更新标题
  var titleElement = document.getElementById('test-title');
  if (titleElement) {
    titleElement.innerHTML = re_scale_only ? "社会责任感测试(RE量表)" : questions[0];
  }
  
  // 清空ans数组，准备新测试
  var maxQuestions = longform ? questions.length : 371;
  ans = new Array(maxQuestions).fill(undefined);
  
  // 使用单题模式加载问题
  doc_write_all_questions();
}

// 开始测试的函数
function startTest() {
  // 隐藏配置面板
  document.querySelector('.config-panel').style.display = 'none';
  
  // 显示问题容器
  var questionsContainer = document.getElementById('questions-container');
  questionsContainer.style.display = 'block';
  
  // 初始化问题
  reloadQuestions();
  
  // 滚动到问题区域
  questionsContainer.scrollIntoView({behavior: 'smooth'});
  
  console.log("测试开始 - 性别:", gender, "测试类型:", re_scale_only ? "社会责任感" : (longform ? "完整" : "简短"));
}

// 更新分页控制器 - 优化DOM操作
function updatePaginationControls() {
  var paginationContainer = cachedDomElements.paginationControls;
  if (!paginationContainer) {
    paginationContainer = document.getElementById('pagination-controls');
    if (!paginationContainer) {
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'pagination-controls';
      paginationContainer.className = 'pagination-controls';
      
      var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
      if (questionsContent) {
        questionsContent.parentNode.insertBefore(paginationContainer, questionsContent.nextSibling);
        cachedDomElements.paginationControls = paginationContainer;
      }
    }
  }
  
  // 使用文档片段一次性更新DOM
  var fragment = document.createDocumentFragment();
  
  // 添加"上一页"按钮
  var prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.textContent = '上一页';
  prevButton.className = 'pagination-button prev-button';
  prevButton.disabled = currentPage === 1;
  prevButton.onclick = function() {
    if (currentPage > 1) {
      currentPage--;
      updatePagination();
      // 滚动到顶部
      var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
      if (questionsContainer) {
        questionsContainer.scrollIntoView({behavior: 'smooth'});
      }
    }
  };
  fragment.appendChild(prevButton);
  
  // 添加页码指示器
  var pageIndicator = document.createElement('span');
  pageIndicator.className = 'page-indicator';
  pageIndicator.textContent = currentPage + ' / ' + totalPages;
  fragment.appendChild(pageIndicator);
  
  // 添加"下一页"按钮
  var nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = '下一页';
  nextButton.className = 'pagination-button next-button';
  nextButton.disabled = currentPage === totalPages;
  nextButton.onclick = function() {
    if (currentPage < totalPages) {
      currentPage++;
      updatePagination();
      // 滚动到顶部
      var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
      if (questionsContainer) {
        questionsContainer.scrollIntoView({behavior: 'smooth'});
      }
    }
  };
  fragment.appendChild(nextButton);
  
  // 添加跳转到页码的功能
  var jumpContainer = document.createElement('div');
  jumpContainer.className = 'jump-container';
  
  var jumpInput = document.createElement('input');
  jumpInput.type = 'number';
  jumpInput.min = 1;
  jumpInput.max = totalPages;
  jumpInput.value = currentPage;
  jumpInput.className = 'jump-input';
  
  var jumpButton = document.createElement('button');
  jumpButton.type = 'button';
  jumpButton.textContent = '跳转';
  jumpButton.className = 'jump-button';
  jumpButton.onclick = function() {
    var pageNum = parseInt(jumpInput.value, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      currentPage = pageNum;
      updatePagination();
      // 滚动到顶部
      var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
      if (questionsContainer) {
        questionsContainer.scrollIntoView({behavior: 'smooth'});
      }
    }
  };
  
  jumpContainer.appendChild(jumpInput);
  jumpContainer.appendChild(jumpButton);
  fragment.appendChild(jumpContainer);
  
  // 清空并一次性更新DOM
  paginationContainer.innerHTML = '';
  paginationContainer.appendChild(fragment);
}

// 更新进度条函数 - 优化计算和DOM操作
function updateProgressBar() {
  // 缓存计算结果，使用函数闭包存储
  if (typeof updateProgressBar.cachedAnsweredCount === 'undefined') {
    updateProgressBar.cachedAnsweredCount = -1;
    updateProgressBar.cachedTotalQuestions = -1;
  }
  
  var currentAnsweredCount = countAnsweredQuestions();
  var currentTotalQuestions = calculateTotalQuestions();
  
  // 如果没有变化，避免不必要的DOM更新
  if (updateProgressBar.cachedAnsweredCount === currentAnsweredCount && 
      updateProgressBar.cachedTotalQuestions === currentTotalQuestions) {
    return Math.floor((currentAnsweredCount / currentTotalQuestions) * 100);
  }
  
  // 更新缓存
  updateProgressBar.cachedAnsweredCount = currentAnsweredCount;
  updateProgressBar.cachedTotalQuestions = currentTotalQuestions;
  
  var percentage = currentTotalQuestions > 0 ? 
      Math.floor((currentAnsweredCount / currentTotalQuestions) * 100) : 0;
  
  // 获取或创建进度条容器
  var progressBarContainer = cachedDomElements.progressContainer;
  if (!progressBarContainer) {
    progressBarContainer = document.getElementById('progress-container');
    if (!progressBarContainer) {
      progressBarContainer = document.createElement('div');
      progressBarContainer.id = 'progress-container';
      progressBarContainer.className = 'progress-container';
      
      var progressBarElement = document.createElement('div');
      progressBarElement.id = 'progress-bar';
      progressBarElement.className = 'progress-bar';
      
      var progressTextElement = document.createElement('div');
      progressTextElement.id = 'progress-text';
      progressTextElement.className = 'progress-text';
      
      progressBarContainer.appendChild(progressBarElement);
      progressBarContainer.appendChild(progressTextElement);
      
      var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
      if (questionsContainer) {
        questionsContainer.insertBefore(progressBarContainer, questionsContainer.firstChild);
        
        // 更新缓存
        cachedDomElements.progressContainer = progressBarContainer;
        cachedDomElements.progressBar = progressBarElement;
        cachedDomElements.progressText = progressTextElement;
      }
    } else {
      // 找到了现有的进度条容器，更新缓存
      cachedDomElements.progressContainer = progressBarContainer;
      cachedDomElements.progressBar = document.getElementById('progress-bar');
      cachedDomElements.progressText = document.getElementById('progress-text');
    }
  }
  
  var progressBar = cachedDomElements.progressBar || document.getElementById('progress-bar');
  var progressText = cachedDomElements.progressText || document.getElementById('progress-text');
  
  if (progressBar && progressText) {
    // 使用requestAnimationFrame避免在同一帧中多次更新
    requestAnimationFrame(function() {
      progressBar.style.width = percentage + '%';
      progressText.textContent = '已完成: ' + currentAnsweredCount + ' / ' + 
          currentTotalQuestions + ' (' + percentage + '%)';
    });
  }
  
  return percentage;
}

// 计算已回答的问题数
function countAnsweredQuestions() {
  var answeredQuestions = 0;

  if (re_scale_only) {
    var re_index = findReScale();
    if (re_index !== -1) {
      var re_qs_true = scales[re_index][1];
      var re_qs_false = scales[re_index][2];
      
      // 合并数组，减少循环次数
      var re_qs = re_qs_true.concat(re_qs_false);
      for (var i = 0; i < re_qs.length; i++) {
        var q_num = re_qs[i];
        if (ans[q_num] === "T" || ans[q_num] === "F") {
          answeredQuestions++;
        }
      }
    }
  } else {
    var totalQuestions = longform ? questions.length - 1 : 370;
    // 使用一次循环，避免多次条件判断
    for (var i = 1; i <= totalQuestions; i++) {
      if (ans[i] === "T" || ans[i] === "F") {
        answeredQuestions++;
      }
    }
  }
  
  return answeredQuestions;
}

// 计算总问题数
function calculateTotalQuestions() {
  if (re_scale_only) {
    var re_index = findReScale();
    if (re_index !== -1) {
      return scales[re_index][1].length + scales[re_index][2].length;
    }
    return 0;
  }
  return longform ? questions.length - 1 : 370;
}

// 更新提交按钮状态 - 优化DOM操作和条件判断
function updateSubmitButtonState() {
  var percentage = updateProgressBar();
  var submitButton = cachedDomElements.submitButton || document.getElementById('submit-button');
  var promptText = cachedDomElements.submitPrompt || document.getElementById('submit-prompt');
  
  if (!submitButton || !promptText) return;
  
  // 只在状态有变化时更新DOM
  var isComplete = percentage === 100;
  var wasDisabled = submitButton.disabled;
  
  if (isComplete !== !wasDisabled) { // 状态发生变化
    requestAnimationFrame(function() {
      if (isComplete) {
        // 所有问题都已回答
        submitButton.disabled = false;
        submitButton.textContent = '我已确认我选的无误！开始计算得分';
        submitButton.classList.add('ready');
        promptText.textContent = '您已完成所有问题，可以提交了！';
        promptText.classList.add('complete');
      } else {
        // 还有未回答的问题
        submitButton.disabled = true;
        submitButton.textContent = '请先完成所有问题';
        submitButton.classList.remove('ready');
        promptText.textContent = '请回答所有问题后再提交（已完成' + percentage + '%）';
        promptText.classList.remove('complete');
      }
    });
  } else if (!isComplete) {
    // 只更新完成百分比文本
    promptText.textContent = '请回答所有问题后再提交（已完成' + percentage + '%）';
  }
}

// Score the test
function score() {
  // Change mouse pointer to wait indicator
  document.body.style.cursor = "wait";

  // 清空并显示结果区域
  var resultsContent = cachedDomElements.resultsContent || document.getElementById('results-content');
  if (!resultsContent) {
    // 如果结果区域不存在，创建一个
    var resultsContainer = document.createElement('div');
    resultsContainer.id = 'results-container';
    resultsContainer.style.display = 'block';
    
    var resultsTitle = document.createElement('h2');
    resultsTitle.textContent = '测试结果';
    
    resultsContent = document.createElement('div');
    resultsContent.id = 'results-content';
    
    resultsContainer.appendChild(resultsTitle);
    resultsContainer.appendChild(resultsContent);
    
    // 使用文档片段一次性添加到body
    var fragment = document.createDocumentFragment();
    fragment.appendChild(resultsContainer);
    document.body.appendChild(fragment);
    
    // 更新缓存
    cachedDomElements.resultsContent = resultsContent;
    cachedDomElements.resultsContainer = resultsContainer;
  } else {
    // 如果结果区域存在，清空内容
    resultsContent.innerHTML = '';
    // 显示结果容器
    var resultsContainer = cachedDomElements.resultsContainer || document.getElementById('results-container');
    if (resultsContainer) {
      resultsContainer.style.display = 'block';
    }
  }

  // 隐藏问题区域
  var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
  if (questionsContainer) {
    questionsContainer.style.display = 'none';
  }

  // 滚动到结果区域
  var resultsContainer = cachedDomElements.resultsContainer || document.getElementById('results-container');
  if (resultsContainer) {
    resultsContainer.scrollIntoView({behavior: 'smooth'});
  }

  // 使用Web Worker或者setTimeout来避免阻塞UI线程
  setTimeout(function() {
    calculateAndDisplayResults(resultsContent);
  }, 0);
}

// 计算并显示结果 - 将计分逻辑拆分为单独函数以提高可维护性
function calculateAndDisplayResults(resultsContent) {
  // Variable declarations
  var i, j, tscale, q, n, s, rp;
  var k, rawscore, kscore, tscore, percent;
  var t_cnt, f_cnt, cs_cnt, pe;

  // 创建一个文档片段来批量添加结果元素
  var fragment = document.createDocumentFragment();

  // Make the scale and critical item tables
  var scale_table = make_result_table(
    "因子",
    "Scale Description",
    "原始分",
    "K(校正)原始分-K Score",
    "T Score",
    "% Answered"
  );
  var ci_table = make_result_table(
    "因子",
    "Scale Description",
    "Question",
    "Answer",
    "Question Text"
  );

  // Count the number of True, False, and Can't Say answers - 优化计数逻辑
  n = longform ? questions.length : 371;
  t_cnt = 0;
  f_cnt = 0;
  cs_cnt = 0;
  
  // 使用更高效的数组方法统计不同答案的数量
  var answerCounts = countAnswerTypes(1, n);
  t_cnt = answerCounts.trueCount;
  f_cnt = answerCounts.falseCount;
  cs_cnt = answerCounts.uncertainCount;
  
  --q;

  // Add T/F/? stats to scale table
  append_result_tr(
    scale_table,
    "True",
    " ",
    t_cnt,
    " ",
    " ",
    ((t_cnt * 100) / q).toPrecision(3)
  );
  append_result_tr(
    scale_table,
    "False",
    " ",
    f_cnt,
    " ",
    " ",
    ((f_cnt * 100) / q).toPrecision(3)
  );
  append_result_tr(
    scale_table,
    "?",
    " ",
    cs_cnt,
    " ",
    " ",
    ((cs_cnt * 100) / q).toPrecision(3)
  );

  // 如果只测试RE量表，则只计算RE量表的分数
  if (re_scale_only) {
    // 使用专门的RE量表处理函数
    analyze_re_scale_result(scale_table, resultsContent);
    
    // 添加返回按钮
    addActionButtons(resultsContent);
    
    // 恢复鼠标指针
    document.body.style.cursor = "default";
    return;
  }

  // Score the TRIN/VRIN scales - 优化循环
  calculateRinScales(scale_table);

  // Score the scales and critical items
  k = 0;
  pe = 0;
  
  // 优化量表计算
  calculateScalesAndItems(scale_table, ci_table, k, pe);
  
  // Convert profile elevation sum to average (divide by number of scales)
  pe /= 8;
  // Show profile elevation in page
  append_result_text("Profile Elevation: " + pe.toPrecision(3));

  // 优化答案摘要显示
  addAnswerSummary(resultsContent);

  // 添加操作按钮
  addActionButtons(resultsContent);

  // Change mouse pointer back to normal
  document.body.style.cursor = "default";
}

// 统计不同类型答案的数量
function countAnswerTypes(start, end) {
  var trueCount = 0;
  var falseCount = 0;
  var uncertainCount = 0;
  
  // 一次性循环统计所有答案类型
  for (var q = start; q < end; ++q) {
    switch (ans[q]) {
      case "T":
        ++trueCount;
        break;
      case "F":
        ++falseCount;
        break;
      default:
        ++uncertainCount;
        break;
    }
  }
  
  return {
    trueCount: trueCount,
    falseCount: falseCount,
    uncertainCount: uncertainCount
  };
}

// 计算RIN量表
function calculateRinScales(scale_table) {
  // Iterate the *RIN scales
  for (var i = 0; i < rin.length; ++i) {
    // Start with default score
    var rawscore = rin[i][0][2];
    
    // 优化：将数组访问缓存到局部变量
    var rinPairs = rin[i][1];
    
    // Iterate all the answer pairs
    for (var j = 0; j < rinPairs.length; ++j) {
      // Get reference to answer pair - 缓存数组元素减少访问次数
      var rp = rinPairs[j];
      // If answers match, update the raw score
      if (ans[rp[0]] === rp[1] && ans[rp[2]] === rp[3]) {
        rawscore += rp[4];
      }
    }
    
    // 使用缓存的值，减少重复计算
    var rinInfo = rin[i][0];
    var tScore = rin[i][2 + gender][rawscore];
    
    // Append results to scale table
    append_result_tr(
      scale_table,
      rinInfo[0],
      rinInfo[1],
      rawscore,
      " ",
      tScore,
      " "
    );
  }
}

// 计算量表和关键项目
function calculateScalesAndItems(scale_table, ci_table, k, pe) {
  // Iterate all the scales
  for (var i = 0; i < scales.length; ++i) {
    var n = 0;
    var rawscore = 0;
    
    // 缓存频繁访问的数组，减少查找时间
    var scaleInfo = scales[i][0];
    var trueQuestions = scales[i][1];
    var falseQuestions = scales[i][2];
    
    // Get the T score table, critcal items will not have this (undefined)
    var tscale = scales[i][3 + gender];
    
    // 优化：预先计算条件判断结果
    var isCriticalItem = tscale === undefined;
    
    // 优化计算逻辑
    if (!isCriticalItem) {
      // 如果是普通量表，使用更高效的计算方法
      var result = calculateScaleScore(trueQuestions, falseQuestions);
      n = result.answeredCount;
      rawscore = result.rawScore;
    } else {
      // 如果是关键项目，需要单独处理以添加到关键项目表格
      var result = calculateCriticalItemScore(trueQuestions, falseQuestions, ci_table, scaleInfo);
      n = result.answeredCount;
      rawscore = result.rawScore;
    }
    
    // Add scale results to scale table
    // T score table must be defined, otherwise this is a critical item
    if (!isCriticalItem) {
      // Capture K for future use
      if (scaleInfo[0] === "K") {
        k = rawscore;
      }
      
      // If there is a K correction, use it
      var kscore, tscore;
      if (tscale[0]) {
        // Adjust with K
        kscore = k * tscale[0] + rawscore;
        // Round off and make integer
        kscore = Math.floor(kscore + 0.5);
        // T score lookup of corrected score
        tscore = tscale[kscore + 1];
      } else {
        // K score is undefinded
        kscore = undefined;
        // T score lookup of raw score
        tscore = tscale[rawscore + 1];
      }
      
      // Calculate percent answered
      var percent = (n * 100) / (trueQuestions.length + falseQuestions.length);
      
      // Append results to score table
      append_result_tr(
        scale_table,
        scaleInfo[1],
        scaleInfo[2],
        rawscore,
        kscore === undefined ? " " : kscore,
        tscore,
        percent.toPrecision(3)
      );

      // Update profile elevation for the 8 scales
      switch (scaleInfo[1]) {
        case "Hs":
        case "D":
        case "Hy":
        case "Pd":
        case "Pa":
        case "Pt":
        case "Sc":
        case "Ma":
          pe += tscore;
          break;
      }
    }
  }
  
  return pe;
}

// 计算普通量表得分
function calculateScaleScore(trueQuestions, falseQuestions) {
  var answeredCount = 0;
  var rawScore = 0;
  
  // 处理True问题
  for (var j = 0; j < trueQuestions.length; ++j) {
    var q = trueQuestions[j];
    switch (ans[q]) {
      case "T":
        ++answeredCount;
        ++rawScore;
        break;
      case "F":
        ++answeredCount;
        break;
    }
  }
  
  // 处理False问题
  for (var j = 0; j < falseQuestions.length; ++j) {
    var q = falseQuestions[j];
    switch (ans[q]) {
      case "F":
        ++answeredCount;
        ++rawScore;
        break;
      case "T":
        ++answeredCount;
        break;
    }
  }
  
  return {
    answeredCount: answeredCount,
    rawScore: rawScore
  };
}

// 计算关键项目得分并添加到表格
function calculateCriticalItemScore(trueQuestions, falseQuestions, ci_table, scaleInfo) {
  var answeredCount = 0;
  var rawScore = 0;
  
  // 处理True问题
  for (var j = 0; j < trueQuestions.length; ++j) {
    var q = trueQuestions[j];
    switch (ans[q]) {
      case "T":
        ++answeredCount;
        ++rawScore;
        append_result_tr(
          ci_table,
          scaleInfo[1],
          scaleInfo[2],
          q,
          "True",
          questions[q]
        );
        break;
      case "F":
        ++answeredCount;
        break;
    }
  }
  
  // 处理False问题
  for (var j = 0; j < falseQuestions.length; ++j) {
    var q = falseQuestions[j];
    switch (ans[q]) {
      case "F":
        ++answeredCount;
        ++rawScore;
        append_result_tr(
          ci_table,
          scaleInfo[1],
          scaleInfo[2],
          q,
          "False",
          questions[q]
        );
        break;
      case "T":
        ++answeredCount;
        break;
    }
  }
  
  return {
    answeredCount: answeredCount,
    rawScore: rawScore
  };
}

// 添加答案摘要
function addAnswerSummary(resultsContent) {
  append_result_text("答案摘要：", resultsContent);
  
  // 使用更高效的字符串拼接方法
  var answerGroups = [];
  var currentGroup = "";
  
  for (var q = 1; q < questions.length; ++q) {
    currentGroup += ans[q] || "?";
    if (currentGroup.length >= 75) {
      answerGroups.push(currentGroup);
      currentGroup = "";
    }
  }
  
  if (currentGroup.length) {
    answerGroups.push(currentGroup);
  }
  
  // 批量添加答案摘要
  var summaryFragment = document.createDocumentFragment();
  for (var i = 0; i < answerGroups.length; i++) {
    var p = document.createElement('p');
    p.textContent = answerGroups[i];
    summaryFragment.appendChild(p);
  }
  
  resultsContent.appendChild(summaryFragment);
}

// 添加操作按钮
function addActionButtons(resultsContent) {
  var buttonContainer = document.createElement('div');
  buttonContainer.className = 'action-buttons';
  
  var backButton = document.createElement('button');
  backButton.textContent = '返回测试';
  backButton.className = 'back-button';
  backButton.onclick = function() {
    var resultsContainer = cachedDomElements.resultsContainer || document.getElementById('results-container');
    var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
    
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (questionsContainer) questionsContainer.style.display = 'block';
  };
  
  // 添加JSON导出按钮
  var jsonButton = document.createElement('button');
  jsonButton.textContent = '导出JSON数据';
  jsonButton.className = 'export-button json-button';
  jsonButton.onclick = function() { exportTestResults(); };
  
  // 添加CSV导出按钮
  var csvButton = document.createElement('button');
  csvButton.textContent = '导出CSV数据';
  csvButton.className = 'export-button csv-button';
  csvButton.onclick = function() { exportCSVResults(); };
  
  buttonContainer.appendChild(backButton);
  buttonContainer.appendChild(jsonButton);
  buttonContainer.appendChild(csvButton);
  resultsContent.appendChild(buttonContainer);
}

// 导出结果为CSV格式
function exportCSVResults() {
  try {
    // 显示加载指示器
    var loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'export-loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>正在准备CSV数据，请稍候...</p>';
    loadingIndicator.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; z-index:9999;';
    document.body.appendChild(loadingIndicator);
    
    setTimeout(function() {
      try {
        // 准备基本信息CSV
        var basicInfoCSV = "测试信息\n";
        basicInfoCSV += "测试时间," + new Date().toISOString() + "\n";
        basicInfoCSV += "测试类型," + (longform ? "完整测试" : (re_scale_only ? "社会责任感测试" : "简短测试")) + "\n";
        basicInfoCSV += "年龄," + (age || "未设置") + "\n";
        basicInfoCSV += "性别," + (gender === 0 ? "男性" : "女性") + "\n\n";
        
        // 准备量表结果CSV
        var scaleResultsCSV = "量表代码,量表名称,原始分,K校正分,T分,回答百分比\n";
        
        // 遍历所有量表，计算得分
        for (var i = 0; i < scales.length; i++) {
          var scaleInfo = scales[i][0];
          var tscale = scales[i][3 + gender];
          
          // 跳过关键项目
          if (tscale === undefined) continue;
          
          // 计算量表得分
          var trueQuestions = scales[i][1];
          var falseQuestions = scales[i][2];
          var rawScore = 0;
          var answeredCount = 0;
          
          // 处理True问题
          for (var j = 0; j < trueQuestions.length; j++) {
            var q = trueQuestions[j];
            switch (ans[q]) {
              case "T":
                answeredCount++;
                rawScore++;
                break;
              case "F":
                answeredCount++;
                break;
            }
          }
          
          // 处理False问题
          for (var j = 0; j < falseQuestions.length; j++) {
            var q = falseQuestions[j];
            switch (ans[q]) {
              case "F":
                answeredCount++;
                rawScore++;
                break;
              case "T":
                answeredCount++;
                break;
            }
          }
          
          // 计算K校正得分和T分
          var kScore, tScore;
          if (scaleInfo[0] === "K") {
            k = rawScore;
          }
          
          if (tscale[0]) {
            // K校正
            kScore = k * tscale[0] + rawScore;
            kScore = Math.floor(kScore + 0.5);
            tScore = tscale[kScore + 1];
          } else {
            kScore = "";
            tScore = tscale[rawScore + 1];
          }
          
          // 计算百分比
          var percent = (answeredCount * 100) / (trueQuestions.length + falseQuestions.length);
          
          // 添加量表结果行
          scaleResultsCSV += '"' + scaleInfo[1] + '","' + scaleInfo[2] + '",' + 
                            rawScore + ',' + (kScore !== "" ? kScore : "") + ',' + 
                            tScore + ',' + percent.toPrecision(3) + '\n';
        }
        
        // 准备答案CSV
        var answersCSV = "题号,问题,答案\n";
        for (var i = 1; i < ans.length; i++) {
          if (ans[i]) {
            // 处理问题文本中的双引号，CSV格式中需要将双引号变成两个双引号
            var questionText = questions[i].replace(/"/g, '""');
            answersCSV += i + ',"' + questionText + '",' + ans[i] + '\n';
          }
        }
        
        // 准备关键项目CSV
        var criticalItemsCSV = "量表代码,量表名称,题号,答案,问题文本\n";
        for (var i = 0; i < scales.length; i++) {
          var scaleInfo = scales[i][0];
          var tscale = scales[i][3 + gender];
          
          // 只处理关键项目
          if (tscale !== undefined) continue;
          
          var trueQuestions = scales[i][1];
          var falseQuestions = scales[i][2];
          
          // 处理True问题
          for (var j = 0; j < trueQuestions.length; j++) {
            var q = trueQuestions[j];
            if (ans[q] === "T") {
              var questionText = questions[q].replace(/"/g, '""');
              criticalItemsCSV += '"' + scaleInfo[1] + '","' + scaleInfo[2] + '",' + 
                                q + ',True,"' + questionText + '"\n';
            }
          }
          
          // 处理False问题
          for (var j = 0; j < falseQuestions.length; j++) {
            var q = falseQuestions[j];
            if (ans[q] === "F") {
              var questionText = questions[q].replace(/"/g, '""');
              criticalItemsCSV += '"' + scaleInfo[1] + '","' + scaleInfo[2] + '",' + 
                                q + ',False,"' + questionText + '"\n';
            }
          }
        }
        
        // 合并所有CSV数据
        var csvData = "# MMPI测试结果 - " + (age || "未设置") + "岁 - " + (gender === 0 ? "男性" : "女性") + " - " + 
                      (longform ? "完整测试" : (re_scale_only ? "社会责任感测试" : "简短测试")) + "\n" +
                      "# 导出时间: " + new Date().toLocaleString() + "\n\n" +
                      "## 基本信息\n" + basicInfoCSV +
                      "## 量表结果\n" + scaleResultsCSV + "\n" +
                      "## 答案\n" + answersCSV + "\n" +
                      "## 关键项目\n" + criticalItemsCSV;
        
        // 添加UTF-8 BOM头，确保Excel正确识别中文
        var BOM = "\uFEFF";
        csvData = BOM + csvData;
        
        // 创建Blob对象，明确指定UTF-8编码
        var blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        // 创建下载链接
        var downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = getNowFormatDate() + '_MMPI结果数据.csv';
        
        // 模拟点击下载
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 移除加载指示器
        document.body.removeChild(loadingIndicator);
        
        // 提示用户
        alert("测试结果数据已成功导出为CSV格式。此格式便于在Excel等电子表格软件中分析。");
      } catch (error) {
        console.error("导出CSV数据时出错：", error);
        alert("导出数据时出错：" + error.message);
        
        // 移除加载指示器
        document.body.removeChild(loadingIndicator);
      }
    }, 100);
  } catch (error) {
    console.error("导出CSV数据过程中出错：", error);
    alert("导出CSV数据时发生错误：" + error.message);
    
    // 移除加载指示器
    var loadingElement = document.getElementById('export-loading');
    if (loadingElement) {
      document.body.removeChild(loadingElement);
    }
  }
}

// 添加提交按钮
function addSubmitButton(element) {
  var actionButtonsDiv = document.createElement('div');
  actionButtonsDiv.className = 'action-buttons';
  
  // 添加检查答案按钮
  var checkButton = document.createElement('button');
  checkButton.type = 'button';
  checkButton.textContent = '检查未答问题';
  checkButton.className = 'check-button';
  checkButton.onclick = function() {
    // 检查未回答的问题
    checkIncompleteQuestions();
  };
  
  // 添加提交按钮（初始为禁用状态）
  var submitButton = document.createElement('button');
  submitButton.type = 'button';
  submitButton.textContent = '开始计算得分';
  submitButton.className = 'submit-button';
  submitButton.id = 'submit-button';
  submitButton.disabled = true; // 初始禁用
  submitButton.onclick = function() { 
    score_rb(document.forms.questions);
  };
  
  // 创建提示文本
  var promptText = document.createElement('div');
  promptText.className = 'submit-prompt';
  promptText.id = 'submit-prompt';
  promptText.textContent = '请回答所有问题后再提交';
  
  actionButtonsDiv.appendChild(checkButton);
  actionButtonsDiv.appendChild(submitButton);
  actionButtonsDiv.appendChild(promptText);
  element.appendChild(actionButtonsDiv);
  
  // 更新缓存
  cachedDomElements.submitButton = submitButton;
  cachedDomElements.submitPrompt = promptText;
  
  // 初始更新按钮状态
  updateSubmitButtonState();
  
  return submitButton;
}

// 检查未完成的问题
function checkIncompleteQuestions() {
  var incompleteQuestions = [];
  
  // 获取所有问题
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  if (!questionsContent) return;
  
  var allQuestions = questionsContent.querySelectorAll('.question-item, .re-question');
  
  console.log("开始检查未完成问题...");
  
  // 将问题元素按ID排序
  var sortedQuestions = Array.from(allQuestions).sort(function(a, b) {
    var idA = parseInt(a.id.substring(1), 10);
    var idB = parseInt(b.id.substring(1), 10);
    return idA - idB;
  });
  
  // 检查每个问题的答案状态
  for (var i = 0; i < sortedQuestions.length; i++) {
    var questionId = sortedQuestions[i].id;
    if (questionId) {
      var questionNumber = parseInt(questionId.substring(1), 10); // 去掉"q"前缀并转为数字
      
      // 检查ans数组中是否没有这个问题的答案，或者答案是否为"?"
      if (!ans[questionNumber] || ans[questionNumber] === "?") {
        incompleteQuestions.push({
          index: i,
          number: questionNumber,
          element: sortedQuestions[i]
        });
        console.log("未完成题目：", questionNumber, "显示序号：", i+1);
      }
    }
  }
  
  if (incompleteQuestions.length > 0) {
    // 找到第一个未完成问题的索引
    var firstIncompleteIndex = incompleteQuestions[0].index;
    
    // 计算它所在的页码
    var firstIncompletePage = Math.floor(firstIncompleteIndex / questionsPerPage) + 1;
    
    console.log("第一个未完成问题索引：", firstIncompleteIndex, "页码：", firstIncompletePage);
    
    // 创建未完成问题提示
    var message = '您还有 ' + incompleteQuestions.length + ' 个问题未完成（' + 
                 Math.round((incompleteQuestions.length / sortedQuestions.length) * 100) + '%）。\n';
    message += '第一个未完成的问题在第 ' + firstIncompletePage + ' 页。\n';
    message += '是否要跳转到该页？';
    
    if (confirm(message)) {
      currentPage = firstIncompletePage;
      updatePagination();
      
      // 延迟执行，确保分页完成后再滚动
        setTimeout(function() {
        // 找到页面上第一个未完成的问题并滚动到它
        var firstVisibleIncomplete = incompleteQuestions.find(function(q) {
          return q.element.style.display !== 'none';
        });
        
        if (firstVisibleIncomplete) {
          firstVisibleIncomplete.element.scrollIntoView({behavior: 'smooth', block: 'center'});
          
          // 高亮未完成的问题
          firstVisibleIncomplete.element.classList.add('highlight-incomplete');
          setTimeout(function() {
            firstVisibleIncomplete.element.classList.remove('highlight-incomplete');
          }, 3000);
          
          console.log("滚动到问题：", firstVisibleIncomplete.number);
        } else {
          console.error("无法找到可见的未完成问题");
        }
        }, 500);
    }
  } else {
    alert('恭喜！您已完成所有问题。');
  }
}

// 添加快速导航功能
function addQuickNavigation(skipProgressUpdate) {
  var quickNavContainer = document.getElementById('quick-nav-container');
  if (!quickNavContainer) {
    quickNavContainer = document.createElement('div');
    quickNavContainer.id = 'quick-nav-container';
    quickNavContainer.className = 'quick-nav-container';
    
    var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
    if (questionsContainer) {
      questionsContainer.appendChild(quickNavContainer);
    }
  }
  
  quickNavContainer.innerHTML = '';
  
  // 添加标题
  var navTitle = document.createElement('h3');
  navTitle.textContent = '问题导航';
  navTitle.className = 'quick-nav-title';
  quickNavContainer.appendChild(navTitle);
  
  // 添加导航控制器
  var navControls = document.createElement('div');
  navControls.className = 'quick-nav-controls';
  
  // 计算总页数
  var totalQuestions = longform ? questions.length - 1 : 370;
  if (re_scale_only) {
    var re_index = findReScale();
    if (re_index !== -1) {
      totalQuestions = scales[re_index][1].length + scales[re_index][2].length;
    }
  }
  
  totalPages = Math.ceil(totalQuestions / questionsPerPage);
  
  // 创建页码导航 - 使用文档片段减少DOM操作
  var fragment = document.createDocumentFragment();
  var pageNav = document.createElement('div');
  pageNav.className = 'page-nav-buttons';
  
  for (var i = 1; i <= totalPages; i++) {
    var pageButton = document.createElement('button');
    pageButton.textContent = i;
    pageButton.className = 'page-nav-button' + (i === currentPage ? ' active' : '');
    pageButton.setAttribute('data-page', i);
    pageButton.onclick = function() {
      currentPage = parseInt(this.getAttribute('data-page'), 10);
      updatePagination();
      // 更新导航按钮激活状态
      var navButtons = document.querySelectorAll('.page-nav-button');
      for (var j = 0; j < navButtons.length; j++) {
        navButtons[j].classList.remove('active');
      }
      this.classList.add('active');
      
      // 滚动到顶部
      var questionsContainer = cachedDomElements.questionsContainer || document.getElementById('questions-container');
      if (questionsContainer) {
        questionsContainer.scrollIntoView({behavior: 'smooth'});
      }
    };
    pageNav.appendChild(pageButton);
  }
  
  fragment.appendChild(pageNav);
  navControls.appendChild(fragment);
  quickNavContainer.appendChild(navControls);
  
  // 添加答题进度信息
  var progressInfo = document.createElement('div');
  progressInfo.className = 'quick-nav-progress';
  progressInfo.textContent = '请回答所有问题后提交';
  quickNavContainer.appendChild(progressInfo);
  
  // 添加未完成问题提示
  var percentage = skipProgressUpdate ? null : updateProgressBar();
  if (percentage !== null && percentage < 100) {
    var incompleteInfo = document.createElement('div');
    incompleteInfo.className = 'incomplete-info';
    incompleteInfo.textContent = '还有未完成的问题，请检查所有页面';
    quickNavContainer.appendChild(incompleteInfo);
  }
}

// Score the test using the radio buttons
function score_rb(form) {
  // 确保表单存在
  if (!form) {
    console.error("表单不存在");
    alert("发生错误：无法找到测试表单。请刷新页面重试。");
    return;
  }
  
  try {
    // 检查已回答的问题数量
    var totalQuestions = document.querySelectorAll('.question-item, .re-question').length;
    var answeredNonUncertain = 0;
    
    // 计算已明确回答的问题数量（排除"?"答案）
    for (var i = 1; i < ans.length; i++) {
      if (ans[i] === "T" || ans[i] === "F") {
        answeredNonUncertain++;
      }
    }
    
    var percentage = Math.floor((answeredNonUncertain / totalQuestions) * 100);
    
    // 如果回答不完整，询问用户是否继续
    if (percentage < 100) {
      if (!confirm('您还有 ' + (totalQuestions - answeredNonUncertain) + ' 个问题未完成（' + (100 - percentage) + '%），确定要提交吗？')) {
        return; // 用户取消提交
      }
    }
    
    // 输出收集到的答案，帮助调试
    console.log("最终收集到的答案：", ans);
    console.log("RE量表模式：", re_scale_only);
    
    // 确保scales变量存在
    if (typeof scales === 'undefined') {
      console.error("scales变量未定义");
      alert("错误：无法加载量表数据。请刷新页面重试。");
      return;
    }
    
    // 计算得分
    score();
  } catch (error) {
    console.error("计算得分时出错：", error);
    alert("计算得分时发生错误：" + error.message);
  }
}

// 使用RE量表
function use_re_scale() {
  re_scale_only = true;
  
  // 重置当前页码
  currentPage = 1;
  
  return true;
}

// 专门用于RE量表的查找和处理
function findReScale() {
  // 确保scales变量已定义
  if (typeof scales === 'undefined') {
    console.error("scales变量未定义");
    return -1;
  }
  
  // 查找RE量表的索引
  for (var i = 0; i < scales.length; ++i) {
    if (scales[i][0] && scales[i][0][1] === "Re") {
      console.log("找到RE量表，索引为：", i);
      return i;
    }
  }
  
  console.error("未找到RE量表");
  return -1;
}

// 获取当前日期时间，格式化为字符串
function getNowFormatDate() {
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hour = date.getHours();
  var minute = date.getMinutes();
  var second = date.getSeconds();

  if (month < 10) month = '0' + month;
  if (day < 10) day = '0' + day;
  if (hour < 10) hour = '0' + hour;
  if (minute < 10) minute = '0' + minute;
  if (second < 10) second = '0' + second;
  
  return 'MMPI测试结果_' + year + month + day + '_' + hour + minute + second;
}

// 分析并显示RE量表结果
function analyze_re_scale_result(scale_table, resultsContent) {
  // 查找RE量表的索引
  var re_index = findReScale();
  if (re_index === -1) {
    // 没有找到RE量表，显示错误信息
    append_result_text("错误：未找到社会责任感量表(RE)数据。请刷新页面重试。", resultsContent);
    console.error("错误：未找到RE量表数据");
    return;
  }
  
  console.log("计算RE量表得分，索引为：", re_index);
  // 计算RE量表分数
  var n = 0;
  var rawscore = 0;
  var tscale = scales[re_index][3 + gender];
  
  if (!tscale) {
    console.error("无法获取T分数表", gender, re_index, scales[re_index]);
    append_result_text("错误：无法获取社会责任感量表得分转换表。请尝试选择不同性别或刷新页面。", resultsContent);
    return;
  }
  
  // 收集RE量表的所有问题
  var re_questions = [];
  
  // 收集True问题
  console.log("True问题数量：", scales[re_index][1].length);
  for (var j = 0; j < scales[re_index][1].length; ++j) {
    var q = scales[re_index][1][j];
    re_questions.push({
      original_num: q,
      is_true_question: true
    });
    
    // 检查答案是否存在
    if (ans[q] !== undefined) {
      switch (ans[q]) {
        case "T":
          ++n;
          ++rawscore;
          console.log("问题 " + q + " 答案为T，得分+1");
          break;
        case "F":
          ++n;
          console.log("问题 " + q + " 答案为F，得分不变");
          break;
      }
    } else {
      console.log("问题 " + q + " 没有答案");
    }
  }
  
  // 收集False问题
  console.log("False问题数量：", scales[re_index][2].length);
  for (j = 0; j < scales[re_index][2].length; ++j) {
    q = scales[re_index][2][j];
    re_questions.push({
      original_num: q,
      is_true_question: false
    });
    
    // 检查答案是否存在
    if (ans[q] !== undefined) {
      switch (ans[q]) {
        case "F":
          ++n;
          ++rawscore;
          console.log("问题 " + q + " 答案为F，得分+1");
          break;
        case "T":
          ++n;
          console.log("问题 " + q + " 答案为T，得分不变");
          break;
      }
    } else {
      console.log("问题 " + q + " 没有答案");
    }
  }
  
  // 按照原始题号排序
  re_questions.sort(function(a, b) {
    return a.original_num - b.original_num;
  });
  
  console.log("RE量表原始得分：", rawscore);
  console.log("回答的问题数：", n);
  console.log("T分表：", tscale);
  
  // 安全获取T分
  var tscore = 50; // 默认值
  if (tscale && rawscore + 1 < tscale.length) {
    tscore = tscale[rawscore + 1] || 50;
  } else {
    console.log("T分表索引超出范围或未定义", rawscore + 1, tscale ? tscale.length : "tscale未定义");
  }
  
  var percent = (n * 100) / (scales[re_index][1].length + scales[re_index][2].length);
  
  // 添加RE量表结果到表格
  append_result_tr(
    scale_table,
    scales[re_index][0][1],
    scales[re_index][0][2],
    rawscore,
    " ",
    tscore,
    percent.toPrecision(3)
  );
  
  // 添加RE量表解释
  append_result_text("社会责任感量表(Re)解释：", resultsContent);
  
  if (tscore >= 65) {
    append_result_text("您的社会责任感得分较高，表明您可能具有较强的社会责任感和道德感。高分者通常表现出对社会规范和道德准则的高度认同，愿意承担责任，遵守社会规则，并关心他人福祉。", resultsContent);
  } else if (tscore >= 45 && tscore < 65) {
    append_result_text("您的社会责任感得分处于正常范围，表明您具有适当的社会责任感和道德观念，能够平衡个人需求与社会责任。", resultsContent);
  } else {
    append_result_text("您的社会责任感得分较低，可能表明您在社会责任和道德约束方面的认同感较弱。低分者可能更倾向于追求个人利益，对社会规范的认同度较低。", resultsContent);
  }
  
  // 显示答案摘要，但仅显示RE量表相关问题的答案
  append_result_text("答案摘要（仅RE量表问题）：", resultsContent);
  var s = "";
  
  // 显示排序后的问题答案，使用连续的序号
  for (j = 0; j < re_questions.length; ++j) {
    var re_q = re_questions[j];
    var q_num = re_q.original_num;
    var display_num = j + 1;
    var answer = ans[q_num] || "?";
    var expected = re_q.is_true_question ? "T" : "F";
    var correct = answer === expected;
    
    s += display_num + "(" + q_num + "):" + answer + (correct ? "✓" : "✗") + " ";
    if (s.length >= 75) {
      append_result_text(s, resultsContent);
      s = "";
    }
  }
  
  if (s.length) {
    append_result_text(s, resultsContent);
  }
}

// Set the form length
function use_long_form(lf) {
  longform = lf;
  re_scale_only = false;
}

// Set the gender
function set_gender(g) {
  gender = g;
}

// Set the age
function set_age(a) {
  age = a;
}

// 监听表单变化以更新进度条
function setupProgressMonitoring() {
  // 添加事件委托，监听整个表单内的radio变化
  var form = document.forms.questions;
  if (form) {
    // 这里不需要单独添加事件监听器，因为我们已经在setupEventDelegation中处理了
    // 但我们仍然需要这个函数以保持代码兼容性
    console.log("进度监控已设置");
  }
  
  // 初始化进度条和提交按钮状态
  setTimeout(function() {
    updateProgressBar();
    updateSubmitButtonState();
  }, 200); // 短暂延迟确保DOM已完全加载
}

// 数据导出函数 - 将结果导出为JSON格式
function exportTestResults() {
  try {
    // 显示加载指示器
    var loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'export-loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>正在准备数据，请稍候...</p>';
    loadingIndicator.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; z-index:9999;';
    document.body.appendChild(loadingIndicator);
    
    setTimeout(function() {
      try {
        // 收集所有答案数据
        var testData = {
          timestamp: new Date().toISOString(),
          testType: longform ? "完整测试" : (re_scale_only ? "社会责任感测试" : "简短测试"),
          age: age || "未设置",
          gender: gender === 0 ? "男性" : "女性",
          answers: []
        };
        
        // 添加答案数据
        for (var i = 1; i < ans.length; i++) {
          if (ans[i]) {
            testData.answers.push({
              questionNumber: i,
              question: questions[i],
              answer: ans[i]
            });
          }
        }
        
        // 收集量表结果
        testData.scaleResults = [];
        
        // 遍历所有量表，计算得分
        for (var i = 0; i < scales.length; i++) {
          var scaleInfo = scales[i][0];
          var tscale = scales[i][3 + gender];
          
          // 跳过关键项目
          if (tscale === undefined) continue;
          
          // 计算量表得分
          var trueQuestions = scales[i][1];
          var falseQuestions = scales[i][2];
          var rawScore = 0;
          var answeredCount = 0;
          
          // 处理True问题
          for (var j = 0; j < trueQuestions.length; j++) {
            var q = trueQuestions[j];
            switch (ans[q]) {
              case "T":
                answeredCount++;
                rawScore++;
                break;
              case "F":
                answeredCount++;
                break;
            }
          }
          
          // 处理False问题
          for (var j = 0; j < falseQuestions.length; j++) {
            var q = falseQuestions[j];
            switch (ans[q]) {
              case "F":
                answeredCount++;
                rawScore++;
                break;
              case "T":
                answeredCount++;
                break;
            }
          }
          
          // 计算K校正得分和T分
          var kScore, tScore;
          if (scaleInfo[0] === "K") {
            k = rawScore;
          }
          
          if (tscale[0]) {
            // K校正
            kScore = k * tscale[0] + rawScore;
            kScore = Math.floor(kScore + 0.5);
            tScore = tscale[kScore + 1];
    } else {
            kScore = undefined;
            tScore = tscale[rawScore + 1];
          }
          
          // 计算百分比
          var percent = (answeredCount * 100) / (trueQuestions.length + falseQuestions.length);
          
          // 添加量表结果
          testData.scaleResults.push({
            code: scaleInfo[1],
            name: scaleInfo[2],
            rawScore: rawScore,
            kCorrectedScore: kScore,
            tScore: tScore,
            percentAnswered: parseFloat(percent.toPrecision(3))
          });
        }
        
        // 添加关键项目
        testData.criticalItems = [];
        for (var i = 0; i < scales.length; i++) {
          var scaleInfo = scales[i][0];
          var tscale = scales[i][3 + gender];
          
          // 只处理关键项目
          if (tscale !== undefined) continue;
          
          var trueQuestions = scales[i][1];
          var falseQuestions = scales[i][2];
          
          // 处理True问题
          for (var j = 0; j < trueQuestions.length; j++) {
            var q = trueQuestions[j];
            if (ans[q] === "T") {
              testData.criticalItems.push({
                code: scaleInfo[1],
                name: scaleInfo[2],
                questionNumber: q,
                answer: "True",
                questionText: questions[q]
              });
            }
          }
          
          // 处理False问题
          for (var j = 0; j < falseQuestions.length; j++) {
            var q = falseQuestions[j];
            if (ans[q] === "F") {
              testData.criticalItems.push({
                code: scaleInfo[1],
                name: scaleInfo[2],
                questionNumber: q,
                answer: "False",
                questionText: questions[q]
              });
            }
          }
        }
        
        // 生成JSON字符串，使用格式化并保持中文字符
        var jsonString = JSON.stringify(testData, null, 2);
        
        // 添加UTF-8 BOM头，确保Excel和其他应用程序正确识别中文
        var BOM = "\uFEFF";
        var jsonStringWithBOM = BOM + jsonString;
        
        // 创建Blob对象，明确指定UTF-8编码
        var blob = new Blob([jsonStringWithBOM], { type: 'application/json;charset=utf-8' });
        
        // 创建下载链接
        var downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = getNowFormatDate() + '_MMPI结果数据.json';
        
        // 模拟点击下载
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 移除加载指示器
        document.body.removeChild(loadingIndicator);
        
        // 提示用户
        alert("测试结果数据已成功导出为JSON格式。此格式更适合专业分析和保存。");
      } catch (error) {
        console.error("导出JSON数据时出错：", error);
        alert("导出数据时出错：" + error.message);
        
        // 移除加载指示器
        document.body.removeChild(loadingIndicator);
      }
    }, 100);
  } catch (error) {
    console.error("导出数据过程中出错：", error);
    alert("导出数据时发生错误：" + error.message);
    
    // 移除加载指示器
    var loadingElement = document.getElementById('export-loading');
    if (loadingElement) {
      document.body.removeChild(loadingElement);
    }
  }
}



