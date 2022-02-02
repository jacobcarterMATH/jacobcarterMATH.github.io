using System;
using System.IO;
using System.Collections.Generic;
namespace D2HTMLtablemaker
{
    class Program
    {
        static void Main(string[] args)
        {
            string input = "";
            string filename;
            Console.Write("Enter the name of your file: ");
            filename = Console.ReadLine();
            List<List<string>> stringList = new List<List<string>>();
            Console.WriteLine("Next, enter the categories of your table, or type '-1' if you are done.");
            while(input != "-1")
            {
                input = Console.ReadLine();
                if (input != "-1")
                {
                    stringList.Add(new List<string>());
                    stringList[stringList.Count - 1].Add(input);
                }
            }

            Console.WriteLine("ADD ENTRIES");

            input = "";

            while (input != "-1")
            {
                Console.WriteLine("TYPE ANYTHING TO BEGIN A NEW ENTRY, OR '-1' TO EXIT");
                if(Console.ReadLine() == "-1")
                {
                    break;
                }
                else
                {
                    Console.WriteLine("NEW ENTRY:");
                    for(int i = 0; i < stringList.Count; i++)
                    {
                        Console.Write($"{stringList[i][0]}: ");
                        stringList[i].Add(Console.ReadLine());
                    }

                }

            }

            FileStream stream = File.Open(filename, FileMode.Create);
            StreamWriter writer = new StreamWriter(stream);
            writer.WriteLine("<table>");
            for(int i = 0; i < stringList[0].Count; i++)
            {
               
               writer.WriteLine("    <tr>");
                 

                for(int j = 0; j < stringList.Count; j++)
                {
                    if (i == 0)
                    {
                        writer.WriteLine($"        <th> {stringList[j][i]} </th>");
                    } else
                    {
                        writer.WriteLine($"        <td> {stringList[j][i]} </td>");
                    }
                }

               
               writer.WriteLine("    </tr>");
              
            }
            writer.WriteLine("</table>");

            writer.Close();
        }
    }
}
