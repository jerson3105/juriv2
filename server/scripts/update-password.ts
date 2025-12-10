import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function updatePassword() {
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 12);
  
  console.log('Hash generado:', hashedPassword);
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'juried_db',
  });
  
  await connection.execute(
    'UPDATE users SET password = ? WHERE email = ?',
    [hashedPassword, 'profesor@juried.com']
  );
  
  console.log('✅ Contraseña actualizada para profesor@juried.com');
  
  await connection.end();
}

updatePassword().catch(console.error);
