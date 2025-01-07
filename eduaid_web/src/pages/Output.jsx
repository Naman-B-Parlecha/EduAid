import React, { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import '../index.css'
import logo from '../assets/aossie_logo.png'

const Output = () => {
  const [qaPairs, setQaPairs] = useState([])
  const [questionType, setQuestionType] = useState(
    localStorage.getItem('selectedQuestionType')
  )

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  useEffect(() => {
    const qaPairsFromStorage = JSON.parse(localStorage.getItem('qaPairs')) || {}
    if (qaPairsFromStorage) {
      const combinedQaPairs = []

      if (qaPairsFromStorage['output_boolq']) {
        qaPairsFromStorage['output_boolq']['Boolean_Questions'].forEach(
          (question, index) => {
            combinedQaPairs.push({
              question,
              question_type: 'Boolean',
              context: qaPairsFromStorage['output_boolq']['Text'],
            })
          }
        )
      }

      if (qaPairsFromStorage['output_mcq']) {
        qaPairsFromStorage['output_mcq']['questions'].forEach((qaPair) => {
          combinedQaPairs.push({
            question: qaPair.question_statement,
            question_type: 'MCQ',
            options: qaPair.options,
            answer: qaPair.answer,
            context: qaPair.context,
          })
        })
      }

      if (qaPairsFromStorage['output_shortq']) {
        qaPairsFromStorage['output_shortq']['questions'].forEach((qaPair) => {
          combinedQaPairs.push({
            question: qaPair.Question,
            question_type: 'Short',
            answer: qaPair.Answer,
            context: qaPair.context,
          })
        })
      }

      if (questionType === 'get_mcq') {
        qaPairsFromStorage['output'].forEach((qaPair) => {
          const options = qaPair.options
          const correctAnswer = qaPair.answer

          combinedQaPairs.push({
            question: qaPair.question_statement,
            question_type: 'MCQ_Hard',
            options: options,
            answer: correctAnswer,
          })
        })
      }

      if (questionType == 'get_boolq') {
        qaPairsFromStorage['output'].forEach((qaPair) => {
          combinedQaPairs.push({
            question: qaPair,
            question_type: 'Boolean',
          })
        })
      } else if (qaPairsFromStorage['output'] && questionType !== 'get_mcq') {
        qaPairsFromStorage['output'].forEach((qaPair) => {
          combinedQaPairs.push({
            question:
              qaPair.question || qaPair.question_statement || qaPair.Question,
            options: qaPair.options,
            answer: qaPair.answer || qaPair.Answer,
            context: qaPair.context,
            question_type: 'Short',
          })
        })
      }

      setQaPairs(combinedQaPairs)
    }
  }, [])

  const generateGoogleForm = async () => {
    const response = await fetch('http://localhost:5000/generate_gform', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        qa_pairs: qaPairs,
        question_type: questionType,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      const formUrl = result.form_link
      window.open(formUrl, '_blank')
    } else {
      console.error('Failed to generate Google Form.')
    }
  }

  const generatePDF = async () => {
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage()
    const d = new Date(Date.now())
    page.drawText('EduAid generated Quiz', { x: 50, y: 800, size: 20 })
    page.drawText('Created On: ' + d.toString(), { x: 50, y: 770, size: 10 })
    const form = pdfDoc.getForm()
    let y = 700 // Starting y position for content
    let questionIndex = 1

    console.log('here inside downloading', qaPairs)

    qaPairs.forEach((qaPair) => {
      if (y < 50) {
        page = pdfDoc.addPage()
        y = 700
      }

      // i'm implementing a question text wrapping logic so that it doesn't overflow the page
      const questionText = `Q${questionIndex}) ${qaPair.question}`
      const maxLineLength = 67
      const lines = []

      let start = 0
      while (start < questionText.length) {
        let end = start + maxLineLength
        if (end < questionText.length && questionText[end] !== ' ') {
          while (end > start && questionText[end] !== ' ') {
            end--
          }
        }
        if (end === start) {
          end = start + maxLineLength
        }
        lines.push(questionText.substring(start, end).trim())
        start = end + 1
      }

      lines.forEach((line) => {
        page.drawText(line, { x: 50, y, size: 15 })
        y -= 20
      })

      y -= 10

      if (qaPair.question_type === 'Boolean') {
        // Create radio buttons for True/False
        const radioGroup = form.createRadioGroup(
          `question${questionIndex}_answer`
        )
        const drawRadioButton = (text, selected) => {
          const options = {
            x: 70,
            y,
            width: 15,
            height: 15,
          }

          radioGroup.addOptionToPage(text, page, options)
          page.drawText(text, { x: 90, y: y + 2, size: 12 })
          y -= 20
        }

        drawRadioButton('True', false)
        drawRadioButton('False', false)
      } else if (
        qaPair.question_type === 'MCQ' ||
        qaPair.question_type === 'MCQ_Hard'
      ) {
        // Shuffle options including qaPair.answer
        const options = [...qaPair.options, qaPair.answer] // Include correct answer in options
        options.sort(() => Math.random() - 0.5) // Shuffle options randomly

        const radioGroup = form.createRadioGroup(
          `question${questionIndex}_answer`
        )

        options.forEach((option, index) => {
          const drawRadioButton = (text, selected) => {
            const radioOptions = {
              x: 70,
              y,
              width: 15,
              height: 15,
            }
            radioGroup.addOptionToPage(text, page, radioOptions)
            page.drawText(text, { x: 90, y: y + 2, size: 12 })
            y -= 20
          }
          drawRadioButton(option, false)
        })

        if (questionIndex % 5 === 0) {
          page = pdfDoc.addPage()
          y = 700
        }
      } else if (qaPair.question_type === 'Short') {
        // Text field for Short answer
        const answerField = form.createTextField(
          `question${questionIndex}_answer`
        )
        answerField.setText('')
        answerField.addToPage(page, {
          x: 50,
          y: y - 20,
          width: 450,
          height: 20,
        })
        y -= 40
      }

      y -= 20 // Space between questions
      questionIndex += 1
    })

    // Save PDF and create download link
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'generated_questions.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="popup w-full h-full bg-[#02000F] flex justify-center items-center">
      <div className="w-full h-full bg-cust bg-opacity-50 bg-custom-gradient">
        <div className="flex flex-col h-full">
          <a href="/">
            <div className="flex items-end gap-[2px]">
              <img src={logo} alt="logo" className="w-16 my-4 ml-4 block" />
              <div className="text-2xl mb-3 font-extrabold">
                <span className="bg-gradient-to-r from-[#FF005C] to-[#7600F2] text-transparent bg-clip-text">
                  Edu
                </span>
                <span className="bg-gradient-to-r from-[#7600F2] to-[#00CBE7] text-transparent bg-clip-text">
                  Aid
                </span>
              </div>
            </div>
          </a>
          <div className="font-bold text-xl text-white mt-3 mx-2">
            Generated Questions
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {qaPairs &&
              qaPairs.map((qaPair, index) => {
                const combinedOptions = qaPair.options
                  ? [...qaPair.options, qaPair.answer]
                  : [qaPair.answer]
                const shuffledOptions = shuffleArray(combinedOptions)
                return (
                  <div
                    key={index}
                    className="px-2 bg-[#d9d9d90d] border-black border my-1 mx-2 rounded-xl py-2"
                  >
                    <div className="text-[#E4E4E4] text-sm">
                      Question {index + 1}
                    </div>
                    <div className="text-[#FFF4F4] text-[1rem] my-1">
                      {qaPair.question}
                    </div>
                    {qaPair.question_type !== 'Boolean' && (
                      <>
                        <div className="text-[#E4E4E4] text-sm">Answer</div>
                        <div className="text-[#FFF4F4] text-[1rem]">
                          {qaPair.answer}
                        </div>
                        {qaPair.options && qaPair.options.length > 0 && (
                          <div className="text-[#FFF4F4] text-[1rem]">
                            {shuffledOptions.map((option, idx) => (
                              <div key={idx}>
                                <span className="text-[#E4E4E4] text-sm">
                                  Option {idx + 1}:
                                </span>{' '}
                                <span className="text-[#FFF4F4] text-[1rem]">
                                  {option}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
          </div>
          <div className="items-center flex justify-center gap-6 mx-auto">
            <button
              className="bg-[#518E8E] items-center flex gap-1 my-2 font-semibold text-white px-2 py-2 rounded-xl"
              onClick={generateGoogleForm}
            >
              Generate Google form
            </button>
            <button
              className="bg-[#518E8E] items-center flex gap-1 my-2 font-semibold text-white px-2 py-2 rounded-xl"
              onClick={generatePDF}
            >
              Generate PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Output
