(() => {
  const ROOT_ID = 'stable-course-reviews';
  const params = new URLSearchParams(location.search);
  const slug = params.get('c') || '';

  const state = {
    course: null,
    reviews: [],
    loadingCourse: true,
    loadingReviews: false,
    submitting: false,
    message: '',
    error: '',
    sort: 'recent'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
