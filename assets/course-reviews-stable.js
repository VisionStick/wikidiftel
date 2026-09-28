(() => {
  const ROOT_ID = 'stable-course-reviews';
  const slug = new URLSearchParams(location.search).get('c') || '';
  const state = { course: null, reviews: [], loadingCourse: true, loadingReviews: false, submitting: false, message: '', error: '', sort: 'recent' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value) => Number