const createActivityService = ({ activityRepository }) => ({
  record(event) {
    return activityRepository.create(event).catch((error) => {
      console.error("Unable to persist activity event:", error.message);
    });
  },
  list(filters) {
    return activityRepository.list(filters);
  },
  recent(limit) {
    return activityRepository.recent(limit);
  },
});

export default createActivityService;