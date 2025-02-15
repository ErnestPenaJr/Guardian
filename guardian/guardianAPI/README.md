

## install ef tooling (if not dotnet-tools.json exists)
dotnet new tool-manifest # if there is no local manifest
dotnet tool install dotnet-ef

otherwise to install tools from dotnet-tools.json 

dotnet tool restore 

## scaffold from database 

dotnet ef dbcontext scaffold "Name=ConnectionStrings:DefaultConnection" Microsoft.EntityFrameworkCore.SqlServer --no-onconfiguring --schema GUARDIAN --namespace Database.Guardian.Entities --output-dir database/guardian/entities --context GuardianDbContext --force

