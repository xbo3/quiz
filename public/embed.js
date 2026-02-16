// 외부 사이트 삽입용 스크립트
// 사용법: <div id="quiz-container"></div>
//         <script src="https://QUIZ_URL/embed.js" data-quiz-id="1"></script>
(function() {
  var script = document.currentScript;
  var quizId = script.getAttribute('data-quiz-id') || '1';
  var origin = script.src.replace(/\/embed\.js.*$/, '');
  var container = document.getElementById('quiz-container');
  if (!container) return;

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/embed/' + quizId;
  iframe.style.width = '100%';
  iframe.style.height = '600px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';
  iframe.allow = 'autoplay; encrypted-media; fullscreen';
  container.appendChild(iframe);
})();
