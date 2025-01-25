

namespace Handlers
{
    public static class TemplateHandler
    {
        public static RouteGroupBuilder MapTemplatesApi(this RouteGroupBuilder group)
        {

            group.MapGet("/templates/fields" , () => {
                
                var fields = """

                """;

                return Results.Ok(fields);
            });

            //subject, financial, address, vehicle
            group.MapGet("/templates", () => {
                
                var templates = """

                """;

                return Results.Ok(templates);
            });
            
            return group;
        }
    }
}