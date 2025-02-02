//User Status: Invited, Pending, Denied, Active, Inactive


using Models;

namespace Repositories
{
    public class NoticeRepository
    {
        public NoticeData? GetNotice(int id)
        {
            return new NoticeData{
                NoticeId = id,
            };
        }

        public List<NoticeData> GetNotices()
        {
            return
            [
                new NoticeData { NoticeId = 1 },
                new NoticeData { NoticeId = 2 },
                new NoticeData { NoticeId = 3 },
                new NoticeData { NoticeId = 4 },
                new NoticeData { NoticeId = 5 }
            ];
        }

        public bool CreateNotice(NoticeData request)
        {
            // create request
            return true;
        }

        public bool UpdateNotice(NoticeData request)
        {
            // update request
            return true;
        }
    }
}