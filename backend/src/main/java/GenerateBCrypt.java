import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class GenerateBCrypt {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String password = "admin123";
        String hashedPassword = encoder.encode(password);
        System.out.println("Password: " + password);
        System.out.println("Hashed Password (BCrypt strength 12): " + hashedPassword);
    }
} 