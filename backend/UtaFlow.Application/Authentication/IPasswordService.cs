namespace UtaFlow.Application.Authentication;

public interface IPasswordService
{
    bool Verify(string? hash, string password);
    string Hash(string password);
}
