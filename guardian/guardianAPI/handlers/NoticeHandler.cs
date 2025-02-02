using Repositories;
using Models;

namespace Handlers
{
    public static class NoticeHandler
    {
        public static RouteGroupBuilder MapNoticeApi(this RouteGroupBuilder group)
        {

            group.MapGet("/notices", (NoticeRepository noticeRepo) => {
                var notices = noticeRepo.GetNotices();

                return Results.Ok(notices);
            });

            group.MapGet("/notices/{id}", (int id) => {
                
            });

            group.MapPost("/notices", (NoticeRepository noticeRepo, NoticeData notice) => {
                noticeRepo.CreateNotice(notice);
                return Results.Ok();
                // return Results.Created($"/notices/{notice.NoticeId}", notice);
            });

            group.MapPut("/notices/{id}", (int id, NoticeRepository noticeRepo, NoticeData notice) => {
                noticeRepo.UpdateNotice(notice);
                return Results.Ok(notice);
            });
            
            return group;
        }
    }
}