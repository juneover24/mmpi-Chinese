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
        // 确保ans数组有足够大小
        while(ans.length <= questionNumber) {
          ans.push(undefined);
        }
        ans[questionNumber] = e.target.value;
        
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
  
  // 获取当前问题的下一个问题
  var nextQuestion = currentQuestion.nextElementSibling;
  
  // 如果存在下一个问题且是当前页的问题，则滚动到它
  if (nextQuestion && (nextQuestion.classList.contains('question-item') || nextQuestion.classList.contains('re-question')) && 
      nextQuestion.style.display !== 'none') {
    setTimeout(function() {
      nextQuestion.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 300);
      } else {
    // 如果是当前页的最后一个问题，检查是否要自动翻页
    var visibleQuestions = document.querySelectorAll('#questions-content .question-item:not([style*="display: none"]), #questions-content .re-question:not([style*="display: none"])');
    if (visibleQuestions.length > 0 && currentQuestion === visibleQuestions[visibleQuestions.length - 1]) {
      // 如果不是最后一页，则自动翻到下一页
      if (currentPage < totalPages) {
        setTimeout(function() {
          var nextButton = document.querySelector('.next-button');
          if (nextButton) nextButton.click();
        }, 500);
      }
    }
  }
}

// 修改doc_write_all_questions函数，使用文档片段和批量DOM操作
function doc_write_all_questions() {
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  if (!questionsContent) {
    console.error('找不到问题容器元素');
    return;
  }
  
  questionsContent.innerHTML = '';
  var fragment = document.createDocumentFragment();
  
  var n = longform ? questions.length : 371;
  
  // 如果是只测试RE量表
  if (re_scale_only) {
    // 查找RE量表的索引
    var re_index = findReScale();
    
    if (re_index !== -1) {
      // 收集RE量表的所有问题
      var re_questions = [];
      
      // 收集True问题
      for (var j = 0; j < scales[re_index][1].length; ++j) {
        var q = scales[re_index][1][j];
        re_questions.push({
          num: q,
          text: questions[q]
        });
      }
      
      // 收集False问题
      for (var j = 0; j < scales[re_index][2].length; ++j) {
        var q = scales[re_index][2][j];
        re_questions.push({
          num: q,
          text: questions[q]
        });
      }
      
      // 按照原始题号排序
      re_questions.sort(function(a, b) {
        return a.num - b.num;
      });
      
      // 批量创建RE量表问题
      var questionsFragment = document.createDocumentFragment();
      for (var j = 0; j < re_questions.length; ++j) {
        add_question_to_fragment(
          questionsFragment,
          re_questions[j].num, 
          (j + 1) + ". " + re_questions[j].text,
          true
        );
      }
      fragment.appendChild(questionsFragment);
    }
  } else {
    // 批量创建普通问题
    var questionsFragment = document.createDocumentFragment();
    for (var i = 1; i < n; ++i) {
      add_question_to_fragment(questionsFragment, i, i + ". " + questions[i]);
    }
    fragment.appendChild(questionsFragment);
  }
  
  // 一次性添加到DOM
  questionsContent.appendChild(fragment);
  
  // 添加提交按钮
  addSubmitButton(questionsContent);
  
  // 初始化分页
  currentPage = 1;
  updatePagination();
  
  // 添加快速导航
  addQuickNavigation();
  
  // 设置事件委托代替每个问题单独绑定事件
  setupEventDelegation();
  
  // 在文档加载完成后设置进度监控
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupProgressMonitoring);
  } else {
    setTimeout(setupProgressMonitoring, 0);
  }
}

// 向文档片段添加问题，减少DOM操作
function add_question_to_fragment(fragment, name, text, isReQuestion) {
  var qid = "q" + name;
  var questionDiv = document.createElement('div');
  questionDiv.className = isReQuestion ? 're-question' : 'question-item';
  questionDiv.id = qid;
  
  // 添加问题文本
  var questionText = document.createElement('div');
  questionText.className = 'question-text';
  questionText.textContent = text;
  questionDiv.appendChild(questionText);
  
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
    input.name = name;
    input.value = option.value;
    input.className = 'option-input';
    
    var span = document.createElement('span');
    span.className = 'option-text';
    span.textContent = option.text;
    
    label.appendChild(input);
    label.appendChild(span);
    optionsContainer.appendChild(label);
  }
  
  // 确保ans数组有足够大小
  while(ans.length <= parseInt(name, 10)) {
    ans.push(undefined);
  }
  
  // 初始不选择任何选项
  ans[parseInt(name, 10)] = undefined;
  
  questionDiv.appendChild(optionsContainer);
  fragment.appendChild(questionDiv);
}

// 优化：使用批处理更新分页
function updatePagination() {
  var totalQuestions = longform ? questions.length - 1 : 370;
  if (re_scale_only) {
    var re_index = findReScale();
    if (re_index !== -1) {
      totalQuestions = scales[re_index][1].length + scales[re_index][2].length;
    }
  }
  
  totalPages = Math.ceil(totalQuestions / questionsPerPage);
  
  // 优化：在一个动画帧中批量更新UI
  requestAnimationFrame(function() {
  // 更新分页导航
  updatePaginationControls();
  
  // 显示当前页的问题
  showQuestionsForPage(currentPage);
  
  // 更新快速导航（可选参数控制是否递归调用）
  setTimeout(function() {
    addQuickNavigation(true);
  }, 0);
  });
}

// 页面加载完成后初始化测试
window.onload = function() {
  try {
    console.log("页面加载完成，开始初始化...");
    
    // 确保数据加载正确
    if (typeof questions === 'undefined' || typeof scales === 'undefined') {
      console.error("测试数据未正确加载");
      alert("测试数据未正确加载，请刷新页面重试。如果问题持续存在，请联系管理员。");
      return;
    }
    
    // 缓存DOM元素
    cacheDomElements();
    
    // 初始化ans数组，使用更高效的方式
    var maxQuestions = longform ? questions.length : 371;
    ans = new Array(maxQuestions).fill(undefined);
    
    // 更新标题
    var titleElement = document.getElementById('test-title');
    if (titleElement && questions && questions[0]) {
      titleElement.textContent = questions[0];
    }
    
    // 初始化测试问题，但不立即显示
    doc_write_all_questions();
    
    console.log("初始化完成");
  } catch (error) {
    console.error("初始化过程中出错：", error);
    alert("初始化测试时发生错误：" + error.message + "。请刷新页面重试。");
  }
};

// 开始测试的函数
function startTest() {
  document.querySelector('.config-panel').style.display = 'none';
  document.getElementById('questions-container').style.display = 'block';
  
  // 设置进度监控
  setupProgressMonitoring();
  
  // 滚动到问题区域
  document.getElementById('questions-container').scrollIntoView({behavior: 'smooth'});
}

// 显示当前页的问题 - 优化DOM操作
function showQuestionsForPage(page) {
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  if (!questionsContent) return;
  
  // 优化：使用类名选择器而不是复杂选择器
  var allQuestions = questionsContent.getElementsByClassName('question-item');
  var reQuestions = questionsContent.getElementsByClassName('re-question');
  var totalQuestions = allQuestions.length + reQuestions.length;
  
  // 计算当前页应该显示哪些问题
  var startIndex = (page - 1) * questionsPerPage;
  var endIndex = Math.min(startIndex + questionsPerPage, totalQuestions);
  
  // 批量处理DOM显示/隐藏，减少布局重排次数
  requestAnimationFrame(function() {
    // 隐藏所有问题
    for (var i = 0; i < allQuestions.length; i++) {
      allQuestions[i].style.display = 'none';
    }
    for (var i = 0; i < reQuestions.length; i++) {
      reQuestions[i].style.display = 'none';
    }
    
    // 显示当前页的问题
    var questionsList = Array.from(allQuestions).concat(Array.from(reQuestions));
    questionsList.sort(function(a, b) {
      return a.id.localeCompare(b.id);
    });
    
    for (var i = startIndex; i < endIndex; i++) {
      if (questionsList[i]) {
        questionsList[i].style.display = 'block';
      }
    }
    
    // 更新进度条
    updateProgressBar();
  });
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
  
  var pdfButton = document.createElement('button');
  pdfButton.textContent = '导出PDF';
  pdfButton.onclick = function() { makeMpdf(); };
  
  buttonContainer.appendChild(backButton);
  buttonContainer.appendChild(pdfButton);
  resultsContent.appendChild(buttonContainer);
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
  
  for (var i = 0; i < allQuestions.length; i++) {
    var questionId = allQuestions[i].id;
    if (questionId) {
      var questionNumber = parseInt(questionId.substring(1), 10); // 去掉"q"前缀并转为数字
      
      // 检查ans数组中是否没有这个问题的答案，或者答案是否为"?"
      if (!ans[questionNumber] || ans[questionNumber] === "?") {
        incompleteQuestions.push(questionNumber);
      }
    }
  }
  
  if (incompleteQuestions.length > 0) {
    // 计算第一个未完成问题所在的页码
    var firstIncompletePage = Math.ceil(incompleteQuestions[0] / questionsPerPage);
    
    // 创建未完成问题提示
    var message = '您还有 ' + incompleteQuestions.length + ' 个问题未完成（' + 
                 Math.round((incompleteQuestions.length / allQuestions.length) * 100) + '%）。\n';
    message += '第一个未完成的问题在第 ' + firstIncompletePage + ' 页。\n';
    message += '是否要跳转到该页？';
    
    if (confirm(message)) {
      currentPage = firstIncompletePage;
      updatePagination();
      // 滚动到第一个未完成的问题
      var questionElement = document.getElementById('q' + incompleteQuestions[0]);
      if (questionElement) {
        setTimeout(function() {
          questionElement.scrollIntoView({behavior: 'smooth', block: 'center'});
          // 高亮未完成的问题
          questionElement.classList.add('highlight-incomplete');
          setTimeout(function() {
            questionElement.classList.remove('highlight-incomplete');
          }, 3000);
        }, 500);
      }
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

// 修改reloadQuestions函数以支持分页
function reloadQuestions() {
  // 更新标题
  var titleElement = document.getElementById('test-title');
  if (titleElement) {
    titleElement.innerHTML = re_scale_only ? "社会责任感测试(RE量表)" : questions[0];
  }
  
  // 清空并重新加载问题
  var questionsContent = cachedDomElements.questionsContent || document.getElementById('questions-content');
  if (questionsContent) {
    // 清空内容
    questionsContent.innerHTML = '';
    
    // 使用文档片段批量创建问题
    var fragment = document.createDocumentFragment();
    
    // 如果只测试RE量表
    if (re_scale_only) {
      // 查找RE量表的索引
      var re_index = findReScale();
      
      if (re_index !== -1) {
        // 收集RE量表的所有问题
        var re_questions = [];
        
        // 收集True问题
        for (var i = 0; i < scales[re_index][1].length; ++i) {
          var q_num = scales[re_index][1][i];
          re_questions.push({
            original_num: q_num,
            text: questions[q_num]
          });
        }
        
        // 收集False问题
        for (var i = 0; i < scales[re_index][2].length; ++i) {
          var q_num = scales[re_index][2][i];
          re_questions.push({
            original_num: q_num,
            text: questions[q_num]
          });
        }
        
        // 按照原始题号排序
        re_questions.sort(function(a, b) {
          return a.original_num - b.original_num;
        });
        
        // 显示排序后的问题，使用连续的序号
        for (var i = 0; i < re_questions.length; ++i) {
          var q = re_questions[i];
          add_question_to_fragment(
            fragment, 
            q.original_num, // 保留原始题号作为name属性，用于计分
            (i + 1) + ". " + q.text, // 显示连续的序号
            true // 标记为RE量表问题
          );
        }
      }
    } else {
      // 正常显示所有问题
      var n = longform ? questions.length : 371;
      for (var i = 1; i < n; ++i) {
        add_question_to_fragment(fragment, i, i + ". " + questions[i]);
      }
    }
    
    // 一次性添加到DOM
    questionsContent.appendChild(fragment);
    
    // 添加提交按钮
    addSubmitButton(questionsContent);
    
    // 初始化分页
    currentPage = 1;
    updatePagination();
    
    // 设置事件委托
    setupEventDelegation();
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


