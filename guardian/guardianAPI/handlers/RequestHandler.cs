using Repositories;
using Models;

namespace Handlers
{
    public static class RequestHandler
    {
        public static RouteGroupBuilder MapRequestApi(this RouteGroupBuilder group)
        {
            group.MapGet("/requests/{id}", (int id, RequestRepository reqRepo) => {
                var req = reqRepo.GetRequest(id);

                if (req == null) {
                    return Results.NotFound();
                }

                return Results.Ok(req);
            });

            group.MapGet("/requests", (RequestRepository reqRepo) => {
                var reqs = reqRepo.GetRequests();

                return Results.Ok(reqs);
            });

            group.MapPost("/requests", (RequestRepository reqRepo, RequestData req) => {
                reqRepo.CreateRequest(req);
                return Results.Ok();
            });

            group.MapPut("/requests/{id}", (int id, RequestRepository reqRepo, RequestData req) => {
                reqRepo.UpdateRequest(req);
                return Results.Ok();
            });

            
            return group;
        }
    }
}