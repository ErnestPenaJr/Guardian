//User Status: Invited, Pending, Denied, Active, Inactive


using Database.Entities;
using Models;

namespace Repositories
{
    public class RequestRepository(GuardianDb db)
    {
        public RequestData? GetRequest(int id)
        {
            return new RequestData{
                RequestId = id,
            };
        }

        public List<RequestData> GetRequests()
        {
            return
            [
                new RequestData { RequestId = 1 },
                new RequestData { RequestId = 2 },
                new RequestData { RequestId = 3 },
                new RequestData { RequestId = 4 },
                new RequestData { RequestId = 5 }
            ];
        }

        public async Task<bool> CreateRequest(RequestData request)
        {
            // create request
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> UpdateRequest(RequestData request)
        {
            // update request
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> CancelRequest(int requestId, string userId)
        {
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> StartRequest(int requestId, string userId)
        {
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> CompleteRequest(int requestId, string userId)
        {
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> AddResults() {
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> AddTask(TaskData task) {
            
            // db.Add(TaskEntity {
            //     TaskId = task.TaskId,
            // });

            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> StartTask(int taskId, string userId) {


            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> CompleteTask(int taskId, string userId) {

            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> CancelTask(int taskId, string userId) {
            
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> AssignTask(int taskId, string userId, string assignedId) {

            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> CreateMilestone() {

            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

        public async Task<bool> GetMilestones(int requestId) {
            
            var changes = await db.SaveChangesAsync();
            return changes > 0;
        }

    }
}