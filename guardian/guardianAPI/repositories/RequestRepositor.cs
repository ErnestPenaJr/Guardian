//User Status: Invited, Pending, Denied, Active, Inactive


using Models;

namespace Repositories
{
    public class RequestRepository
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

        public bool CreateRequest(RequestData request)
        {
            // create request
            return true;
        }

        public bool UpdateRequest(RequestData request)
        {
            // update request
            return true;
        }
    }
}