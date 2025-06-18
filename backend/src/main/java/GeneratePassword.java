import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class GeneratePassword {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String password = "1234";
        String hash = encoder.encode(password);
        System.out.println("Password: " + password);
        System.out.println("Hash: " + hash);
        System.out.println("Verification: " + encoder.matches(password, hash));
    }
} 