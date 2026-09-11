<?php
include 'conexao.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $nome = $_POST['nome'];
    $email = $_POST['email'];

    try {
        $sql = "INSERT INTO animal (Nome, Raça, Saúde, Descrição) VALUES (:Nome, :Raça, :Saúde, :Descrição)
        $stmt = $conn->prepare($sql);
        
        $stmt->bindParam(':Nome', $nome);
        $stmt->bindParam(':Raça', $raça);
        $stmt->bindParam(':Saúde', $saude);
        $stmt->bindParam(':Descrição', $descrição);
        
        $stmt->execute();
        
        echo "Dado salvo com sucesso!";
    } catch (PDOException $e) {
        echo "Erro ao salvar: " . $e->getMessage();
    }
}
?>
